export type GiftNiftyStatus = 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'INVALID';
export type GiftNiftySnapshot = { price:number|null; changePct:number|null; previousClose:number|null; asOf:string|null; source:string; status:GiftNiftyStatus; reason?:string };

export function validateGiftNiftySnapshot(input:{price:unknown;previousClose:unknown;asOf?:unknown;source?:string|null},nowMs=Date.now(),maxAgeMs=120_000):GiftNiftySnapshot{
 const source=input.source?.trim()||'unknown'; const price=typeof input.price==='number'?input.price:Number(input.price); const previousClose=typeof input.previousClose==='number'?input.previousClose:Number(input.previousClose); const asOf=typeof input.asOf==='string'?input.asOf:null; const parsed=asOf?Date.parse(asOf):NaN;
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(previousClose)||previousClose<=0||!Number.isFinite(parsed)) return {price:null,changePct:null,previousClose:Number.isFinite(previousClose)&&previousClose>0?previousClose:null,asOf,source,status:'UNAVAILABLE',reason:'INVALID_GIFT_SNAPSHOT'};
 const changePct=((price-previousClose)/previousClose)*100; if(!Number.isFinite(changePct)) return {price:null,changePct:null,previousClose,asOf,source,status:'INVALID',reason:'INVALID_CHANGE_PCT'};
 const age=nowMs-parsed; if(age< -30_000||age>maxAgeMs) return {price,changePct,previousClose,asOf,source,status:'STALE',reason:`STALE_${Math.round(age/1000)}S`};
 return {price,changePct,previousClose,asOf,source,status:'LIVE'};
}

export async function fetchGiftNifty():Promise<GiftNiftySnapshot>{
 const url=process.env.GIFT_NIFTY_API_URL; if(!url) return {price:null,changePct:null,previousClose:null,asOf:null,source:'not-configured',status:'UNAVAILABLE',reason:'GIFT_NIFTY_API_URL_NOT_CONFIGURED'};
 try{const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)}); if(!response.ok)return {price:null,changePct:null,previousClose:null,asOf:null,source:url,status:'UNAVAILABLE',reason:`HTTP_${response.status}`}; const raw=await response.json() as Record<string,unknown>; return validateGiftNiftySnapshot({price:raw.price??raw.ltp??raw.lastPrice??raw.last,previousClose:raw.previousClose??raw.prevClose??raw.previous_close,asOf:raw.asOf??raw.timestamp??raw.updatedAt??raw.updated_at??raw.time,source:String(raw.source??url)});}catch(error){return {price:null,changePct:null,previousClose:null,asOf:null,source:url,status:'UNAVAILABLE',reason:error instanceof Error?error.message:'FETCH_FAILED'};}
}

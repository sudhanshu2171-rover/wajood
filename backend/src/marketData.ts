import { validateGiftNiftySnapshot, type GiftNiftySnapshot } from './giftNifty.js';

export type IndexSnapshot = { symbol:string; price:number|null; changePct:number|null; asOf:string|null; source:string; status:'LIVE'|'STALE'|'UNAVAILABLE' };

function num(v:unknown):number|null { const n=typeof v==='number'?v:Number(v); return Number.isFinite(n)?n:null; }

export async function fetchGiftNiftyFromConfiguredProvider():Promise<GiftNiftySnapshot>{
  const url=process.env.GIFT_NIFTY_API_URL;
  if(!url) return {price:null,changePct:null,previousClose:null,asOf:null,source:'not-configured',status:'UNAVAILABLE',reason:'GIFT_NIFTY_API_URL_NOT_CONFIGURED'};
  try{
    const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5000)});
    if(!r.ok) return {price:null,changePct:null,previousClose:null,asOf:null,source:url,status:'UNAVAILABLE',reason:`HTTP_${r.status}`};
    const raw=await r.json() as Record<string,unknown>;
    return validateGiftNiftySnapshot({price:num(raw.price??raw.ltp??raw.lastPrice??raw.last),previousClose:num(raw.previousClose??raw.prevClose??raw.previous_close),asOf:typeof(raw.asOf??raw.timestamp??raw.updatedAt??raw.updated_at??raw.time)==='string'?String(raw.asOf??raw.timestamp??raw.updatedAt??raw.updated_at??raw.time):null,source:String(raw.source??url)});
  }catch(e){return {price:null,changePct:null,previousClose:null,asOf:null,source:url,status:'UNAVAILABLE',reason:e instanceof Error?e.message:'FETCH_FAILED'};}
}

export function liveIndexSnapshot(symbol:string,price:unknown,changePct:unknown,asOf:unknown,source:string,maxAgeMs=120_000):IndexSnapshot{
  const p=num(price), c=num(changePct), ts=typeof asOf==='string'?asOf:null, parsed=ts?Date.parse(ts):NaN;
  if(p==null||c==null||!Number.isFinite(parsed)) return {symbol,price:null,changePct:null,asOf:ts,source,status:'UNAVAILABLE'};
  const status=parsed<=Date.now()&&Date.now()-parsed<=maxAgeMs?'LIVE':'STALE';
  return {symbol,price:p,changePct:c,asOf:ts,source,status};
}

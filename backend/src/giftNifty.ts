export type GiftNiftySnapshot = { price: number | null; changePct: number | null; previousClose: number | null; asOf: string | null; source: string; status: 'LIVE' | 'STALE' | 'UNAVAILABLE' };

export function validateGiftNiftySnapshot(input: { price: number | null; previousClose: number | null; asOf: string | null; source?: string | null }, nowMs = Date.now(), maxAgeMs = 120_000): GiftNiftySnapshot {
  const source = input.source?.trim() || 'unknown';
  const priceOk = input.price != null && Number.isFinite(input.price) && input.price > 0;
  const prevOk = input.previousClose != null && Number.isFinite(input.previousClose) && input.previousClose > 0;
  const parsedAsOf = input.asOf ? Date.parse(input.asOf) : NaN;
  const ageOk = Number.isFinite(parsedAsOf) && parsedAsOf <= nowMs && nowMs - parsedAsOf <= maxAgeMs;
  if (!priceOk || !prevOk || !Number.isFinite(parsedAsOf)) return { price:null, changePct:null, previousClose:prevOk ? input.previousClose : null, asOf:input.asOf, source, status:'UNAVAILABLE' };
  const changePct = ((input.price! - input.previousClose!) / input.previousClose!) * 100;
  if (!Number.isFinite(changePct)) return { price:null, changePct:null, previousClose:input.previousClose, asOf:input.asOf, source, status:'UNAVAILABLE' };
  return { price:input.price, changePct, previousClose:input.previousClose, asOf:input.asOf, source, status:ageOk ? 'LIVE' : 'STALE' };
}

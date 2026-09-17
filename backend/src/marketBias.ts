export type Bias = 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL';
export type MarketPhase = 'PRE_OPEN' | 'OPEN_CONFIRMATION' | 'LIVE';

export function resolveMarketBias(input: { phase: MarketPhase; giftNiftyPct: number | null; liveIndexChanges: number[]; liveBreadthPct?: number | null; }): { bias: Bias; strength: 'LOW'|'MEDIUM'|'HIGH'; giftRole: 'PRIMARY_CONTEXT'|'CONFIRMATION_ONLY'|'CONTEXT_ONLY'; reasons: string[] } {
  const live = input.liveIndexChanges.filter(Number.isFinite);
  const liveAvg = live.length ? live.reduce((a,b)=>a+b,0)/live.length : null;
  const up = live.filter(v=>v>0.05).length;
  const down = live.filter(v=>v<-0.05).length;
  const gift = input.giftNiftyPct;
  if (input.phase === 'PRE_OPEN') {
    if (gift == null) return {bias:'NEUTRAL',strength:'LOW',giftRole:'PRIMARY_CONTEXT',reasons:['GIFT_NIFTY_UNAVAILABLE']};
    if (gift > 0.15) return {bias:'BULLISH',strength:'MEDIUM',giftRole:'PRIMARY_CONTEXT',reasons:['GIFT_NIFTY_POSITIVE_PRE_OPEN']};
    if (gift < -0.15) return {bias:'BEARISH',strength:'MEDIUM',giftRole:'PRIMARY_CONTEXT',reasons:['GIFT_NIFTY_NEGATIVE_PRE_OPEN']};
    return {bias:'NEUTRAL',strength:'LOW',giftRole:'PRIMARY_CONTEXT',reasons:['GIFT_NIFTY_FLAT_PRE_OPEN']};
  }
  if (live.length < 2 || liveAvg == null) return {bias:'NEUTRAL',strength:'LOW',giftRole:'CONFIRMATION_ONLY',reasons:['LIVE_MARKET_DATA_INSUFFICIENT']};
  const bias: Bias = up >= Math.ceil(live.length*0.6) && liveAvg > 0.05 ? 'BULLISH' : down >= Math.ceil(live.length*0.6) && liveAvg < -0.05 ? 'BEARISH' : 'MIXED';
  const reasons:string[]=[];
  if (gift != null && ((gift < -0.15 && bias === 'BULLISH') || (gift > 0.15 && bias === 'BEARISH'))) reasons.push('GIFT_LIVE_DIVERGENCE');
  if (input.liveBreadthPct != null && Number.isFinite(input.liveBreadthPct)) reasons.push(`LIVE_BREADTH_${input.liveBreadthPct >= 0 ? 'POSITIVE' : 'NEGATIVE'}`);
  if (!reasons.length) reasons.push('LIVE_INDIAN_MARKET_HAS_PRIORITY');
  return {bias,strength:bias==='MIXED'?'LOW':Math.abs(liveAvg)>=0.5?'HIGH':'MEDIUM',giftRole:input.phase==='OPEN_CONFIRMATION'?'CONFIRMATION_ONLY':'CONTEXT_ONLY',reasons};
}

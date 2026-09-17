export type Bias = 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL';

export type MarketBiasInput = {
  phase: 'PRE_OPEN' | 'OPEN_CONFIRMATION' | 'LIVE';
  giftNiftyPct: number | null;
  liveIndexChanges: number[];
  liveBreadthPct?: number | null;
  livePriceAction?: 'UP' | 'DOWN' | 'MIXED' | null;
};

export type MarketBiasResult = {
  bias: Bias;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  giftRole: 'PRIMARY_CONTEXT' | 'CONFIRMATION_ONLY' | 'CONTEXT_ONLY';
  reasons: string[];
};

/**
 * GIFT Nifty is an overnight/pre-open context signal. Once India is trading,
 * live Indian market evidence has priority. A stale/contradictory GIFT signal
 * must never by itself produce an extreme live bearish/bullish state.
 */
export function resolveMarketBias(input: MarketBiasInput): MarketBiasResult {
  const live = input.liveIndexChanges.filter(Number.isFinite);
  const liveAvg = live.length ? live.reduce((a, b) => a + b, 0) / live.length : null;
  const liveUp = live.filter(v => v > 0.05).length;
  const liveDown = live.filter(v => v < -0.05).length;
  const gift = input.giftNiftyPct;
  const reasons: string[] = [];

  if (input.phase === 'PRE_OPEN') {
    if (gift == null) return { bias: 'NEUTRAL', strength: 'LOW', giftRole: 'PRIMARY_CONTEXT', reasons: ['GIFT_NIFTY_UNAVAILABLE'] };
    if (gift > 0.15) return { bias: 'BULLISH', strength: 'MEDIUM', giftRole: 'PRIMARY_CONTEXT', reasons: ['GIFT_NIFTY_POSITIVE_PRE_OPEN'] };
    if (gift < -0.15) return { bias: 'BEARISH', strength: 'MEDIUM', giftRole: 'PRIMARY_CONTEXT', reasons: ['GIFT_NIFTY_NEGATIVE_PRE_OPEN'] };
    return { bias: 'NEUTRAL', strength: 'LOW', giftRole: 'PRIMARY_CONTEXT', reasons: ['GIFT_NIFTY_FLAT_PRE_OPEN'] };
  }

  if (live.length < 2 || liveAvg == null) {
    return { bias: gift == null ? 'NEUTRAL' : gift > 0 ? 'BULLISH' : gift < 0 ? 'BEARISH' : 'NEUTRAL', strength: 'LOW', giftRole: 'CONFIRMATION_ONLY', reasons: ['LIVE_MARKET_DATA_INSUFFICIENT'] };
  }

  const liveBias: Bias = liveUp >= Math.ceil(live.length * 0.6) && liveAvg > 0.05 ? 'BULLISH' : liveDown >= Math.ceil(live.length * 0.6) && liveAvg < -0.05 ? 'BEARISH' : 'MIXED';
  if (input.livePriceAction && input.livePriceAction !== 'MIXED' && ((input.livePriceAction === 'UP' && liveBias === 'BEARISH') || (input.livePriceAction === 'DOWN' && liveBias === 'BULLISH'))) {
    reasons.push('LIVE_PRICE_ACTION_CONFLICT');
  }
  if (gift != null && ((gift < -0.15 && liveBias === 'BULLISH') || (gift > 0.15 && liveBias === 'BEARISH'))) reasons.push('GIFT_LIVE_DIVERGENCE');
  if (liveBreadthPct != null && Number.isFinite(liveBreadthPct)) reasons.push(`LIVE_BREADTH_${liveBreadthPct >= 0 ? 'POSITIVE' : 'NEGATIVE'}`);

  const strength = liveBias === 'MIXED' ? 'LOW' : Math.abs(liveAvg) >= 0.5 ? 'HIGH' : 'MEDIUM';
  return {
    bias: liveBias,
    strength,
    giftRole: input.phase === 'OPEN_CONFIRMATION' ? 'CONFIRMATION_ONLY' : 'CONTEXT_ONLY',
    reasons: reasons.length ? reasons : ['LIVE_INDIAN_MARKET_HAS_PRIORITY']
  };
}

import { describe, expect, it } from 'vitest';
import { resolveMarketBias } from './marketBias.js';

describe('market bias hierarchy', () => {
  it('uses GIFT as pre-open context', () => {
    expect(resolveMarketBias({ phase:'PRE_OPEN', giftNiftyPct:-0.7, giftStatus:'LIVE', liveIndexChanges:[] }).bias).toBe('BEARISH');
  });
  it('does not let negative GIFT make a positive live Indian market bearish', () => {
    const result=resolveMarketBias({ phase:'LIVE', giftNiftyPct:-0.7, giftStatus:'LIVE', liveIndexChanges:[0.51,0.02,0.57,0.33] });
    expect(result.bias).toBe('BULLISH');
    expect(result.giftRole).toBe('CONTEXT_ONLY');
    expect(result.reasons).toContain('GIFT_LIVE_DIVERGENCE');
  });
  it('returns mixed when live indices disagree', () => {
    expect(resolveMarketBias({ phase:'LIVE', giftNiftyPct:-0.7, giftStatus:'LIVE', liveIndexChanges:[0.5,-0.4,0.1,-0.2] }).bias).toBe('MIXED');
  });
});

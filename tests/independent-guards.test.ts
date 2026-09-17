import { describe, expect, it } from 'vitest';
import { isValidCompletedDailyCandle, liveExecutionGate, shadowOrderBlocked } from '../backend/src/guards.js';

describe('WAJOOD independent safety guards', () => {
  it('rejects zero/invalid daily candles', () => {
    expect(isValidCompletedDailyCandle({open:0,high:10,low:0,close:5})).toBe(false);
    expect(isValidCompletedDailyCandle({open:10,high:12,low:9,close:11})).toBe(true);
  });
  it('blocks every incomplete live execution gate', () => {
    const result = liveExecutionGate({authenticated:true,connected:true,staticIpReady:true,liveTradingEnabled:true,marketOpen:true,dataQuality:'GOOD',signal:'CALL',confidence:70,remainingRisk:5000,spreadPct:1});
    expect(result.allowed).toBe(true);
    const blocked = liveExecutionGate({...({authenticated:true,connected:true,staticIpReady:true,liveTradingEnabled:true,marketOpen:true,dataQuality:'BLOCKED',signal:'CALL',confidence:70,remainingRisk:5000,spreadPct:1})});
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain('DATA_QUALITY_BLOCKED');
  });
  it('never sends broker action in paper/shadow', () => {
    expect(shadowOrderBlocked('PAPER')).toBe(true);
    expect(shadowOrderBlocked('SHADOW')).toBe(true);
    expect(shadowOrderBlocked('MANUAL')).toBe(false);
  });
});

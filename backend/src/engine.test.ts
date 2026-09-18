import { describe, expect, it } from 'vitest';
import { decideMarket, fiveSessionRange } from './engine.js';

const candles=Array.from({length:30},(_,i)=>({open:100+i,high:102+i,low:99+i,close:101+i,volume:1000}));
describe('WAJOOD decision engine',()=>{
  it('requires five valid sessions for range',()=>expect(fiveSessionRange(candles).high).toBe(131));
  it('does not issue a signal when daily risk is exhausted',()=>{
    const r=decideMarket({candles,livePrice:140,dailyRiskRemaining:0,breadthPct:1});
    expect(r.signal).toBe('NO TRADE');
    expect(r.reasons).toContain('DAILY_RISK_EXHAUSTED');
  });
  it('can detect a multi-confirmation bullish breakout',()=>{
    const r=decideMarket({candles,livePrice:140,dailyRiskRemaining:5000,breadthPct:1,option:{callOiChange:1,putOiChange:10}});
    expect(r.signal).toBe('CALL');
  });
});

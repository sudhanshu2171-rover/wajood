export type DataQuality = 'GOOD' | 'DEGRADED' | 'BLOCKED';
export type GuardDecision = { allowed: boolean; reasons: string[] };

export const DAILY_LOSS_LIMIT = 5000;

export function liveExecutionGate(input: {
  authenticated: boolean;
  connected: boolean;
  staticIpReady: boolean;
  liveTradingEnabled: boolean;
  marketOpen: boolean;
  dataQuality: DataQuality;
  signal: 'CALL' | 'PUT' | 'NO TRADE';
  confidence: number;
  remainingRisk: number;
  spreadPct: number | null;
}): GuardDecision {
  const reasons: string[] = [];
  if (!input.authenticated) reasons.push('AUTH_REQUIRED');
  if (!input.connected) reasons.push('ZERODHA_NOT_CONNECTED');
  if (!input.staticIpReady) reasons.push('STATIC_IP_NOT_READY');
  if (!input.liveTradingEnabled) reasons.push('LIVE_TRADING_DISABLED');
  if (!input.marketOpen) reasons.push('MARKET_CLOSED');
  if (input.dataQuality !== 'GOOD') reasons.push(`DATA_QUALITY_${input.dataQuality}`);
  if (input.signal === 'NO TRADE') reasons.push('NO_TRADE_SIGNAL');
  if (input.confidence < 58) reasons.push('CONFIDENCE_BELOW_THRESHOLD');
  if (input.remainingRisk <= 0) reasons.push('DAILY_RISK_EXHAUSTED');
  if (input.spreadPct != null && input.spreadPct > 3) reasons.push('WIDE_SPREAD');
  return { allowed: reasons.length === 0, reasons };
}

export function isValidCompletedDailyCandle(c: { open:number; high:number; low:number; close:number }): boolean {
  return [c.open,c.high,c.low,c.close].every(Number.isFinite) && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0 && c.high >= Math.max(c.open,c.close) && c.low <= Math.min(c.open,c.close) && c.high >= c.low;
}

export function shadowOrderBlocked(mode: 'PAPER'|'SHADOW'|'MANUAL'|'AUTO'): boolean {
  return mode === 'PAPER' || mode === 'SHADOW';
}

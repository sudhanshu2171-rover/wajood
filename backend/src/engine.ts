export type EngineSignal = 'CALL'|'PUT'|'NO TRADE';
export type Candle = { open:number; high:number; low:number; close:number; volume?:number };
export type OptionSnapshot = { callOiChange:number; putOiChange:number; callVolume?:number; putVolume?:number };

const finite = (n:number) => Number.isFinite(n);
export function ema(values:number[], period:number):number|null{
  if(values.length<period) return null;
  let e=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const k=2/(period+1);
  for(const v of values.slice(period)) e=v*k+e*(1-k);
  return e;
}
export function rsi(values:number[], period=14):number|null{
  if(values.length<period+1) return null;
  let gain=0,loss=0;
  for(let i=1;i<=period;i++){const d=values[i]-values[i-1]; if(d>=0) gain+=d; else loss-=d;}
  gain/=period; loss/=period;
  for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1]; const g=d>0?d:0; const l=d<0?-d:0; gain=(gain*(period-1)+g)/period; loss=(loss*(period-1)+l)/period;}
  if(loss===0) return 100;
  return 100-(100/(1+gain/loss));
}
export function atr(candles:Candle[], period=14):number|null{
  if(candles.length<period+1) return null;
  const trs:number[]=[];
  for(let i=1;i<candles.length;i++){const c=candles[i],p=candles[i-1]; trs.push(Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close)));}
  if(trs.length<period) return null;
  let a=trs.slice(0,period).reduce((x,y)=>x+y,0)/period;
  for(const tr of trs.slice(period)) a=(a*(period-1)+tr)/period;
  return a;
}
export function fiveSessionRange(candles:Candle[]):{high:number|null;low:number|null}{
  const valid=candles.filter(c=>finite(c.open)&&finite(c.high)&&finite(c.low)&&finite(c.close)&&c.open>0&&c.high>0&&c.low>0&&c.close>0&&c.high>=Math.max(c.open,c.close)&&c.low<=Math.min(c.open,c.close));
  const recent=valid.slice(-5);
  if(recent.length<5) return {high:null,low:null};
  return {high:Math.max(...recent.map(c=>c.high)),low:Math.min(...recent.map(c=>c.low))};
}
export function decideMarket(input:{
 candles:Candle[];
 livePrice:number;
 option?:OptionSnapshot;
 breadthPct?:number|null;
 dailyRiskRemaining:number;
 spreadPct?:number|null;
}):{signal:EngineSignal;confidence:number;reasons:string[];indicators:Record<string,number|null>;riskAllowed:boolean}{
 const closes=input.candles.map(c=>c.close).filter(finite);
 const e9=ema(closes,9), e21=ema(closes,21), r=rsi(closes,14), a=atr(input.candles,14);
 const range=fiveSessionRange(input.candles);
 const p=input.livePrice;
 let bull=0,bear=0; const reasons:string[]=[];
 if(e9!=null&&e21!=null){if(e9>e21) {bull+=20;reasons.push('EMA9_ABOVE_EMA21')} else if(e9<e21){bear+=20;reasons.push('EMA9_BELOW_EMA21')}}
 if(r!=null){if(r>=55&&r<75){bull+=15;reasons.push('RSI_BULLISH_ZONE')} else if(r<=45&&r>25){bear+=15;reasons.push('RSI_BEARISH_ZONE')}}
 if(range.high!=null&&p>range.high){bull+=25;reasons.push('FIVE_SESSION_HIGH_BREAKOUT')}
 else if(range.low!=null&&p<range.low){bear+=25;reasons.push('FIVE_SESSION_LOW_BREAKDOWN')}
 if(input.breadthPct!=null&&finite(input.breadthPct)){if(input.breadthPct>0.2){bull+=15;reasons.push('BREADTH_POSITIVE')}else if(input.breadthPct<-0.2){bear+=15;reasons.push('BREADTH_NEGATIVE')}}
 if(input.option){if(input.option.putOiChange>input.option.callOiChange){bull+=15;reasons.push('PUT_OI_BUILDUP')}else if(input.option.callOiChange>input.option.putOiChange){bear+=15;reasons.push('CALL_OI_BUILDUP')}}
 const spreadBlocked=input.spreadPct!=null&&input.spreadPct>3;
 const riskBlocked=input.dailyRiskRemaining<=0;
 const top=Math.max(bull,bear); const gap=Math.abs(bull-bear);
 const signal:EngineSignal=(!spreadBlocked&&!riskBlocked&&top>=55&&gap>=15)?(bull>bear?'CALL':'PUT'):'NO TRADE';
 const confidence=signal==='NO TRADE'?Math.min(59,50+Math.round(top/5)):Math.min(95,55+Math.round(gap*0.5));
 const riskAllowed=!spreadBlocked&&!riskBlocked;
 if(spreadBlocked) reasons.push('WIDE_SPREAD');
 if(riskBlocked) reasons.push('DAILY_RISK_EXHAUSTED');
 if(signal==='NO TRADE') reasons.push('CONFIRMATIONS_NOT_ALIGNED');
 return {signal,confidence,reasons,indicators:{ema9:e9,ema21:e21,rsi:r,atr:a,fiveSessionHigh:range.high,fiveSessionLow:range.low,livePrice:p,bullScore:bull,bearScore:bear},riskAllowed};
}

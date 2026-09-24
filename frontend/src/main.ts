import './style.css';

const API = import.meta.env.VITE_API_BASE || '';
const root = document.getElementById('root')!;
root.innerHTML = `
<main>
  <header><div><h1>WAJOOD <small>V2</small></h1><p>MARKET DECISION TERMINAL</p></div><span id="status" class="pill">CONNECTING…</span></header>
  <section class="grid">
    <article><h2>Engine</h2><div id="config">Loading…</div></article>
    <article><h2>Kite WebSocket</h2><div id="kite">Checking live feed…</div></article>
  </section>
  <section class="trade-card">
    <div class="trade-head"><h2>Live Trade Decision</h2><button id="refresh">Refresh</button></div>
    <div id="decision" class="decision blocked"><strong>Checking live market data…</strong></div>
    <div id="reasons" class="reasons"></div>
    <div id="indicators" class="indicators"></div>
  </section>
  <section><h2>Live Tick Monitor</h2><div id="ticks" class="ticks"><div class="muted">Waiting for live ticks…</div></div></section>
  <section><h2>Decision Pipeline</h2><div id="pipeline" class="pipeline"></div></section>
  <section class="warning"><strong>Execution is FAIL-CLOSED</strong><span>WAJOOD can display a signal, but it will not place a broker order from this screen.</span></section>
</main>`;

const set = (id:string, html:string) => { document.getElementById(id)!.innerHTML = html; };

async function loadDecision(){
  try {
    const r = await fetch(`${API}/api/wajood/live-decision?token=256265`, {cache:'no-store'});
    const d = await r.json();
    const cls = d.signal === 'CALL' ? 'call' : d.signal === 'PUT' ? 'put' : 'blocked';
    const label = d.signal === 'CALL' ? 'CALL SIGNAL' : d.signal === 'PUT' ? 'PUT SIGNAL' : 'NO TRADE';
    set('decision', `<div class="signal ${cls}">${label}</div><div class="confidence">Confidence: ${d.confidence ?? 0}% · ${d.dataStatus ?? 'UNKNOWN'}</div><div class="message">${d.message ?? (d.riskAllowed ? 'Risk gate passed.' : 'Risk/data gate blocked this decision.')}</div>`);
    set('reasons', (d.reasons || []).map((x:string)=>`<span>${x}</span>`).join(''));
    const i=d.indicators||{};
    set('indicators', `EMA9 ${fmt(i.ema9)} · EMA21 ${fmt(i.ema21)} · RSI ${fmt(i.rsi)} · ATR ${fmt(i.atr)} · 5C High ${fmt(i.fiveSessionHigh)} · 5C Low ${fmt(i.fiveSessionLow)} · Price ${fmt(i.livePrice)}`);
  } catch {
    set('decision','<div class="signal blocked">NO TRADE</div><div class="message">Decision service unavailable.</div>');
    set('reasons','DECISION_ENDPOINT_UNAVAILABLE');
  }
}
const fmt=(v:any)=>v==null?'—':Number(v).toLocaleString('en-IN',{maximumFractionDigits:2});

async function boot(){
  try {
    const [configRes,kiteRes] = await Promise.all([fetch(`${API}/api/wajood/config`),fetch(`${API}/api/kite/live-status`)]);
    const config = await configRes.json(); const kite = await kiteRes.json();
    document.getElementById('status')!.textContent = 'BACKEND ONLINE';
    document.getElementById('status')!.className = 'pill online';
    set('config', `<b>Mode:</b> ${config.execution}<br><b>Daily risk cap:</b> ₹${config.dailyLossLimit.toLocaleString('en-IN')}<br><b>Feed:</b> ${config.liveFeed}`);
    set('pipeline', config.decisionPipeline.map((x:string,i:number)=>`<span>${i+1}. ${x}</span>`).join(''));
    set('kite', `<b>Configured:</b> ${kite.configured ? 'YES' : 'NO'}<br><b>Connected:</b> ${kite.connected ? 'YES' : 'NO'}<br><b>Last tick:</b> ${kite.lastTickAt || '—'}`);
    loadDecision();
    document.getElementById('refresh')!.addEventListener('click', loadDecision);
    connectTicks();
  } catch {
    document.getElementById('status')!.textContent = 'BACKEND OFFLINE';
    document.getElementById('status')!.className = 'pill offline';
    set('config','Backend unavailable.');
    set('kite','Unable to read Kite status.');
    loadDecision();
  }
}
function connectTicks(){
  if (!('EventSource' in window)) return;
  const source = new EventSource(`${API}/api/kite/ticks`);
  source.addEventListener('ticks',(event)=> {
    const payload = JSON.parse((event as MessageEvent).data);
    const rows = payload.ticks.slice(-8).map((t:any)=>`<div class="tick"><b>${t.instrument_token}</b><strong>${Number(t.last_price).toLocaleString('en-IN',{maximumFractionDigits:2})}</strong><small>${t.exchange_timestamp || t.timestamp || payload.receivedAt}</small></div>`).join('');
    set('ticks', rows || '<div class="muted">No tick payload received.</div>');
    set('kite', 'Live WebSocket: <b>RECEIVING TICKS</b>');
  });
  source.addEventListener('error',()=> set('ticks','<div class="muted">Kite feed not configured or temporarily unavailable.</div>'));
}
boot();

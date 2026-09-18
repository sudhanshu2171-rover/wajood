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
  <section><h2>Live Tick Monitor</h2><div id="ticks" class="ticks"><div class="muted">Waiting for live ticks…</div></div></section>
  <section><h2>Decision Pipeline</h2><div id="pipeline" class="pipeline"></div></section>
  <section class="warning"><strong>Execution is FAIL-CLOSED</strong><span>Paper/Shadow mode never sends broker orders. Live execution remains disabled during migration.</span></section>
</main>`;

const set = (id:string, html:string) => { document.getElementById(id)!.innerHTML = html; };

async function boot(){
  try {
    const [configRes,kiteRes] = await Promise.all([fetch(`${API}/api/wajood/config`),fetch(`${API}/api/kite/live-status`)]);
    const config = await configRes.json(); const kite = await kiteRes.json();
    document.getElementById('status')!.textContent = 'BACKEND ONLINE';
    document.getElementById('status')!.className = 'pill online';
    set('config', `<b>Mode:</b> ${config.execution}<br><b>Daily risk cap:</b> ₹${config.dailyLossLimit.toLocaleString('en-IN')}<br><b>Feed:</b> ${config.liveFeed}`);
    set('pipeline', config.decisionPipeline.map((x:string,i:number)=>`<span>${i+1}. ${x}</span>`).join(''));
    set('kite', `<b>Configured:</b> ${kite.configured ? 'YES' : 'NO'}<br><b>Connected:</b> ${kite.connected ? 'YES' : 'NO'}<br><b>Last tick:</b> ${kite.lastTickAt || '—'}`);
    connectTicks();
  } catch {
    document.getElementById('status')!.textContent = 'BACKEND OFFLINE';
    document.getElementById('status')!.className = 'pill offline';
    set('config','Backend unavailable.');
    set('kite','Unable to read Kite status.');
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

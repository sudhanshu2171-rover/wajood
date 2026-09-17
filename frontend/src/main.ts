import './style.css';
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
const root = document.getElementById('root')!;
root.innerHTML = `<main><header><h1>WAJOOD <small>V2</small></h1><span id="status">CONNECTING…</span></header><section><h2>Independent Trading Engine</h2><p>GitHub is the source of truth. Broker execution remains fail-closed during migration.</p><div id="config">Loading engine configuration…</div></section></main>`;
async function boot(){try{const r=await fetch(`${API}/api/wajood/config`);const d=await r.json();document.getElementById('status')!.textContent='BACKEND ONLINE';document.getElementById('config')!.innerHTML=`<b>Mode:</b> ${d.execution}<br><b>Daily risk cap:</b> ₹${d.dailyLossLimit.toLocaleString('en-IN')}<br><b>Pipeline:</b> ${d.decisionPipeline.join(' → ')}`;}catch{document.getElementById('status')!.textContent='BACKEND OFFLINE';document.getElementById('config')!.textContent='Start the independent backend to connect.';}}
boot();

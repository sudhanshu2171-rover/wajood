import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAILY_LOSS_LIMIT, shadowOrderBlocked } from './guards.js';
import { resolveMarketBias } from './marketBias.js';
import { validateGiftNiftySnapshot, fetchGiftNifty } from './giftNifty.js';
import { createKiteMarketStreamFromEnv } from './kiteStream.js';
import { decideMarket, type Candle } from './engine.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const corsOrigins = process.env.FRONTEND_ORIGIN?.split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins?.length ? corsOrigins : true, credentials: true }));
app.use(express.json({ limit: '256kb' }));
const modeSchema = z.enum(['PAPER','SHADOW','MANUAL','AUTO']);

const kiteApiKey = process.env.KITE_API_KEY?.trim();
const kiteAccessToken = process.env.KITE_ACCESS_TOKEN?.trim();

async function fetchKiteHistorical(token:number, interval='5minute', days=5):Promise<Candle[]> {
  if (!kiteApiKey || !kiteAccessToken) return [];
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const url = new URL(`https://api.kite.trade/instruments/historical/${token}/${interval}`);
  url.searchParams.set('from', from.toISOString().slice(0,10));
  url.searchParams.set('to', to.toISOString().slice(0,10));
  try {
    const response = await fetch(url, {
      headers: { Authorization: `token ${kiteApiKey}:${kiteAccessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return [];
    const body = await response.json() as any;
    const rows = Array.isArray(body?.data?.candles) ? body.data.candles : [];
    return rows.map((r:any) => ({ open:Number(r[1]), high:Number(r[2]), low:Number(r[3]), close:Number(r[4]), volume:Number(r[5] ?? 0) }))
      .filter((c:Candle) => [c.open,c.high,c.low,c.close].every(Number.isFinite));
  } catch {
    return [];
  }
}

const kiteStream = createKiteMarketStreamFromEnv();
const DEFAULT_TOKENS = [256265, 260105, 257801, 265];
if (kiteStream) {
  const tokens = (process.env.KITE_INDEX_TOKENS || DEFAULT_TOKENS.join(','))
    .split(',')
    .map(v => Number(v.trim()))
    .filter(Number.isInteger);
  kiteStream.subscribe(tokens);
  kiteStream.connect();
}

app.get('/api/_healthcheck', (_req,res) => res.json({ ok:true, service:'wajood-backend', time:new Date().toISOString(), kite:kiteStream?.status() ?? {configured:false, connected:false, reason:'KITE_API_KEY or KITE_ACCESS_TOKEN is not configured.'} }));
app.get('/api/kite/live-status', (_req,res) => res.json(kiteStream?.status() ?? { configured:false, connected:false, reason:'KITE_API_KEY or KITE_ACCESS_TOKEN is not configured.' }));
app.get('/api/kite/ticks', (req,res) => {
  res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache, no-transform'); res.setHeader('Connection','keep-alive'); res.flushHeaders?.();
  if (!kiteStream) { res.write(`event: error\ndata: ${JSON.stringify({error:'KITE_NOT_CONFIGURED'})}\n\n`); res.end(); return; }
  const unsubscribe = kiteStream.onTicks(ticks => res.write(`event: ticks\ndata: ${JSON.stringify({ticks, receivedAt:new Date().toISOString()})}\n\n`));
  res.write(`event: status\ndata: ${JSON.stringify(kiteStream.status())}\n\n`);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
});
app.get('/api/kite/execution-status', (_req,res) => res.json({ liveEnabled: process.env.KITE_LIVE_TRADING_ENABLED === 'true', staticIpReady: process.env.KITE_STATIC_IP_READY === 'true', ready:false, dailyLossLimit:DAILY_LOSS_LIMIT, reason:'Order execution remains fail-closed; live market data is independently streamed through Kite WebSocket when credentials are configured.' }));
app.post('/api/kite/order', (req,res) => { const parsed=modeSchema.safeParse(req.body?.mode); if(!parsed.success) return res.status(400).json({error:'Invalid execution mode'}); if(shadowOrderBlocked(parsed.data)) return res.status(423).json({error:'No broker action is permitted in PAPER or SHADOW mode.'}); return res.status(423).json({error:'Independent broker execution adapter is locked during migration.'}); });

app.post('/api/wajood/decision', (req,res) => {
  const parsed = z.object({
    candles:z.array(z.object({open:z.number(),high:z.number(),low:z.number(),close:z.number(),volume:z.number().optional()})).min(5),
    livePrice:z.number(),
    option:z.object({callOiChange:z.number(),putOiChange:z.number(),callVolume:z.number().optional(),putVolume:z.number().optional()}).optional(),
    breadthPct:z.number().nullable().optional(),
    dailyRiskRemaining:z.number().nonnegative(),
    spreadPct:z.number().nullable().optional()
  }).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid decision payload',details:parsed.error.flatten()});
  return res.json(decideMarket(parsed.data));
});

app.get('/api/wajood/live-decision', async (req,res) => {
  const token = Number(req.query.token || 256265);
  if (!Number.isInteger(token)) return res.status(400).json({error:'Invalid instrument token'});
  if (!kiteApiKey || !kiteAccessToken) return res.status(503).json({
    signal:'NO TRADE', confidence:0, reasons:['KITE_CREDENTIALS_MISSING'], riskAllowed:false,
    dataStatus:'BLOCKED', message:'Live Zerodha data is not configured on the deployment.',
    indicators:{ema9:null,ema21:null,rsi:null,atr:null,fiveSessionHigh:null,fiveSessionLow:null,livePrice:null,bullScore:0,bearScore:0}
  });
  const candles = await fetchKiteHistorical(token, '5minute', 5);
  if (candles.length < 30) return res.status(503).json({
    signal:'NO TRADE', confidence:0, reasons:['INSUFFICIENT_LIVE_CANDLES'], riskAllowed:false,
    dataStatus:'BLOCKED', message:`Only ${candles.length} usable candles received; engine requires more live history.`,
    indicators:{ema9:null,ema21:null,rsi:null,atr:null,fiveSessionHigh:null,fiveSessionLow:null,livePrice:candles.at(-1)?.close ?? null,bullScore:0,bearScore:0}
  });
  const livePrice = candles[candles.length - 1].close;
  const result = decideMarket({ candles, livePrice, dailyRiskRemaining: DAILY_LOSS_LIMIT, breadthPct:null, spreadPct:null });
  return res.json({ ...result, dataStatus:'LIVE', instrumentToken:token, candleCount:candles.length, generatedAt:new Date().toISOString() });
});

app.get('/api/wajood/config', (_req,res) => res.json({ version:'2.0-independent', sourceOfTruth:'github', dailyLossLimit:DAILY_LOSS_LIMIT, decisionPipeline:['OBSERVE','DATA QUALITY','MARKET CONTEXT','REGIME','TECHNICAL','OPTION CHAIN/OI','PANIC GUARD','EXPIRY HUNTER','CHALLENGE','DECISION','RISK GATE','EXECUTION GATE'], execution:'fail-closed', marketBiasRule:'After Indian market opens, live Indian indices have priority; GIFT Nifty is context only; stale/invalid GIFT data is ignored.', liveFeed:'Zerodha Kite Connect WebSocket', decisionEndpoint:'/api/wajood/live-decision' }));
app.post('/api/wajood/market-bias', (req,res) => { const schema=z.object({ phase:z.enum(['PRE_OPEN','OPEN_CONFIRMATION','LIVE']), giftNiftyPct:z.number().nullable(), giftStatus:z.enum(['LIVE','STALE','UNAVAILABLE','INVALID']).optional(), liveIndexChanges:z.array(z.number()), liveBreadthPct:z.number().nullable().optional() }); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid market-bias payload'}); return res.json(resolveMarketBias(parsed.data)); });
app.get('/api/wajood/gift-nifty/live', async (_req,res) => { const snapshot = await fetchGiftNifty(); return res.status(snapshot.status === 'LIVE' ? 200 : 503).json(snapshot); });
app.post('/api/wajood/gift-nifty/validate', (req,res) => { const schema=z.object({ price:z.number().nullable(), previousClose:z.number().nullable(), asOf:z.string().nullable(), source:z.string().nullable().optional() }); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid GIFT Nifty snapshot'}); return res.json(validateGiftNiftySnapshot(parsed.data)); });

const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api(?:\/|$)).*/, (_req,res) => res.sendFile(path.join(frontendDist,'index.html'), err => { if (err) res.status(404).send('WAJOOD frontend build not found'); }));
app.listen(port, '0.0.0.0', () => console.log(`WAJOOD independent backend listening on ${port}`));

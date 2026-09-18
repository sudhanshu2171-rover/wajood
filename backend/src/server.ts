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

const app = express();
const port = Number(process.env.PORT || 8787);
const corsOrigins = process.env.FRONTEND_ORIGIN?.split(',').map(v => v.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins?.length ? corsOrigins : true, credentials: true }));
app.use(express.json({ limit: '256kb' }));
const modeSchema = z.enum(['PAPER','SHADOW','MANUAL','AUTO']);

const kiteStream = createKiteMarketStreamFromEnv();
const DEFAULT_TOKENS = [256265, 260105, 257801, 265];
if (kiteStream) kiteStream.subscribe((process.env.KITE_INDEX_TOKENS || DEFAULT_TOKENS.join(',')).split(',').map(Number).filter(Number.isInteger));

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

app.get('/api/wajood/config', (_req,res) => res.json({ version:'2.0-independent', sourceOfTruth:'github', dailyLossLimit:DAILY_LOSS_LIMIT, decisionPipeline:['OBSERVE','DATA QUALITY','MARKET CONTEXT','REGIME','TECHNICAL','OPTION CHAIN/OI','PANIC GUARD','EXPIRY HUNTER','CHALLENGE','DECISION','RISK GATE','EXECUTION GATE'], execution:'fail-closed', marketBiasRule:'After Indian market opens, live Indian indices have priority; GIFT Nifty is context only; stale/invalid GIFT data is ignored.', liveFeed:'Zerodha Kite Connect WebSocket' }));
app.post('/api/wajood/market-bias', (req,res) => { const schema=z.object({ phase:z.enum(['PRE_OPEN','OPEN_CONFIRMATION','LIVE']), giftNiftyPct:z.number().nullable(), giftStatus:z.enum(['LIVE','STALE','UNAVAILABLE','INVALID']).optional(), liveIndexChanges:z.array(z.number()), liveBreadthPct:z.number().nullable().optional() }); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid market-bias payload'}); return res.json(resolveMarketBias(parsed.data)); });
app.get('/api/wajood/gift-nifty/live', async (_req,res) => { const snapshot = await fetchGiftNifty(); return res.status(snapshot.status === 'LIVE' ? 200 : 503).json(snapshot); });
app.post('/api/wajood/gift-nifty/validate', (req,res) => { const schema=z.object({ price:z.number().nullable(), previousClose:z.number().nullable(), asOf:z.string().nullable(), source:z.string().nullable().optional() }); const parsed=schema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:'Invalid GIFT Nifty snapshot'}); return res.json(validateGiftNiftySnapshot(parsed.data)); });

const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api(?:\/|$)).*/, (_req,res) => res.sendFile(path.join(frontendDist,'index.html'), err => { if (err) res.status(404).send('WAJOOD frontend build not found'); }));

app.listen(port, '0.0.0.0', () => console.log(`WAJOOD independent backend listening on ${port}`));

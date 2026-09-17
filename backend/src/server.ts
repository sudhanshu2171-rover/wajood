import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { DAILY_LOSS_LIMIT, shadowOrderBlocked } from './guards.js';
import { resolveMarketBias } from './marketBias.js';
import { validateGiftNiftySnapshot } from './giftNifty.js';

const app = express();
const port = Number(process.env.PORT || 8787);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',').map(v => v.trim()) || true, credentials: true }));
app.use(express.json({ limit: '256kb' }));
const modeSchema = z.enum(['PAPER','SHADOW','MANUAL','AUTO']);

app.get('/api/_healthcheck', (_req,res) => res.json({ ok:true, service:'wajood-backend', time:new Date().toISOString() }));
app.get('/api/kite/execution-status', (_req,res) => res.json({ liveEnabled: process.env.KITE_LIVE_TRADING_ENABLED === 'true', staticIpReady: process.env.KITE_STATIC_IP_READY === 'true', ready:false, dailyLossLimit:DAILY_LOSS_LIMIT, reason:'Independent backend remains fail-closed until broker adapter and risk prerequisites are configured.' }));
app.post('/api/kite/order', (req,res) => { const parsed=modeSchema.safeParse(req.body?.mode); if(!parsed.success) return res.status(400).json({error:'Invalid execution mode'}); if(shadowOrderBlocked(parsed.data)) return res.status(423).json({error:'No broker action is permitted in PAPER or SHADOW mode.'}); return res.status(423).json({error:'Independent broker execution adapter is locked during migration.'}); });

app.get('/api/wajood/config', (_req,res) => res.json({ version:'2.0-independent', sourceOfTruth:'github', dailyLossLimit:DAILY_LOSS_LIMIT, decisionPipeline:['OBSERVE','DATA QUALITY','MARKET CONTEXT','REGIME','TECHNICAL','OPTION CHAIN/OI','PANIC GUARD','EXPIRY HUNTER','CHALLENGE','DECISION','RISK GATE','EXECUTION GATE'], execution:'fail-closed', marketBiasRule:'After Indian market opens, live Indian indices have priority; GIFT Nifty is context only; stale/invalid GIFT data is ignored.' }));

app.post('/api/wajood/market-bias', (req,res) => {
  const schema=z.object({ phase:z.enum(['PRE_OPEN','OPEN_CONFIRMATION','LIVE']), giftNiftyPct:z.number().nullable(), giftStatus:z.enum(['LIVE','STALE','UNAVAILABLE']).optional(), liveIndexChanges:z.array(z.number()), liveBreadthPct:z.number().nullable().optional() });
  const parsed=schema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid market-bias payload'});
  return res.json(resolveMarketBias(parsed.data));
});

app.post('/api/wajood/gift-nifty/validate', (req,res) => {
  const schema=z.object({ price:z.number().nullable(), previousClose:z.number().nullable(), asOf:z.string().nullable(), source:z.string().nullable().optional() });
  const parsed=schema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid GIFT Nifty snapshot'});
  return res.json(validateGiftNiftySnapshot(parsed.data));
});

app.listen(port, () => console.log(`WAJOOD independent backend listening on ${port}`));

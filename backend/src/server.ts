import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { DAILY_LOSS_LIMIT, liveExecutionGate, shadowOrderBlocked } from './guards.js';

const app = express();
const port = Number(process.env.PORT || 8787);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',').map(v => v.trim()) || true, credentials: true }));
app.use(express.json({ limit: '256kb' }));

const modeSchema = z.enum(['PAPER','SHADOW','MANUAL','AUTO']);
app.get('/api/_healthcheck', (_req,res) => res.json({ ok:true, service:'wajood-backend', time:new Date().toISOString() }));
app.get('/api/kite/execution-status', (_req,res) => res.json({
  liveEnabled: process.env.KITE_LIVE_TRADING_ENABLED === 'true',
  staticIpReady: process.env.KITE_STATIC_IP_READY === 'true',
  ready: false,
  dailyLossLimit: DAILY_LOSS_LIMIT,
  reason: 'Independent backend scaffold is fail-closed. Broker order adapter is not enabled in this migration stage.'
}));

app.post('/api/kite/order', (req,res) => {
  const parsed = modeSchema.safeParse(req.body?.mode);
  if (!parsed.success) return res.status(400).json({ error:'Invalid execution mode' });
  if (shadowOrderBlocked(parsed.data)) return res.status(423).json({ error:'No broker action is permitted in PAPER or SHADOW mode.' });
  return res.status(423).json({ error:'Independent broker execution adapter is intentionally locked during migration.' });
});

app.get('/api/wajood/config', (_req,res) => res.json({
  version:'2.0-independent',
  sourceOfTruth:'github',
  dailyLossLimit:DAILY_LOSS_LIMIT,
  decisionPipeline:['OBSERVE','DATA QUALITY','MARKET CONTEXT','REGIME','TECHNICAL','OPTION CHAIN/OI','PANIC GUARD','EXPIRY HUNTER','CHALLENGE','DECISION','RISK GATE','EXECUTION GATE'],
  execution:'fail-closed'
}));

app.listen(port, () => console.log(`WAJOOD independent backend listening on ${port}`));

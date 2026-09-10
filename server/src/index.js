import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { registerWorldRoutes } from './routes/world.js';
import { registerClaimRoutes } from './routes/claims.js';
import { registerActivityRoutes } from './routes/activity.js';
import { registerCoverageFeeRoute } from './hedera/coverage-fee.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Secrets live in the repo-root .env.local, not inside server/ — see .env.example.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const app = express();
app.use(express.json());
// Both Northbeam and Agent Insure HQ run on localhost during the hackathon (plus a phone on
// the same LAN for a live demo — private network ranges only, never the open internet).
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

registerWorldRoutes(app);
registerClaimRoutes(app);
registerCoverageFeeRoute(app, {
  getRequirementParams: () => ({
    amount: process.env.HEDERA_COVERAGE_FEE_AMOUNT || '10000000',
    payToAccountId: process.env.HEDERA_RESERVE_POOL_ACCOUNT_ID,
  }),
});
registerActivityRoutes(app, {
  // Seed vendor — mirrors the frontend's own locked, ENS-approved vendor (TECH-606).
  getVendor: () => ({
    name: 'Acme Corp',
    hederaAccountId: process.env.HEDERA_VENDOR_ACCOUNT_ID,
    amount: 500,
  }),
  // The poisoned path's hardcoded wrong destination — reuses the reserve pool account
  // (a real, already-funded account) rather than provisioning a third one for this.
  // Real deception (a Claude call actually fooled into picking this) is TECH-608.
  wrongAccountId: process.env.HEDERA_RESERVE_POOL_ACCOUNT_ID,
});

// Last line of defense: Express 4 doesn't catch an async handler's thrown error on
// its own — without this, one bad request (e.g. a config problem surfacing as a
// synchronous throw) takes the whole process down instead of just failing that request.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`agent-insure shared backend listening on http://localhost:${port}`);
});

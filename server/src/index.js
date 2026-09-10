import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { registerWorldRoutes } from './routes/world.js';
import { registerClaimRoutes } from './routes/claims.js';

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

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`agent-insure shared backend listening on http://localhost:${port}`);
});

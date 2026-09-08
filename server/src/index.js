import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { registerWorldRoutes } from './routes/world.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Secrets live in the repo-root .env.local, not inside server/ — see .env.example.
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const app = express();
app.use(express.json());
// Both Northbeam and Fidelis run on localhost during the hackathon — allow any
// localhost origin rather than hardcoding one port both apps happen to share today.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
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

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`agent-insure shared backend listening on http://localhost:${port}`);
});

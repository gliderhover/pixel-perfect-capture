# Pocket Pitch Legends

**Team:** Good Bunny
**Members:** Candice Shen · Daniel Yang · Yiqi Song · Helen Deng
**Course:** Generative AI and Social Media — Final Project
**Instructor:** Tauhid Zaman

---

## About the Project

Pocket Pitch Legends is a location-based mobile web app that reimagines how football fans engage with the World Cup 2026. Think Pokémon Go meets football — players explore their real-world surroundings, discover and collect international football legends using their phone's camera, train them through AI-powered conversations, and battle rivals to climb a global leaderboard.

The app is built as an installable Progressive Web App (PWA) and is powered by Google Gemini for in-character AI chat. Each player in your squad has a distinct personality, speaking style, and set of traits — Mbappé talks like Mbappé, Bellingham like Bellingham. Conversations dynamically shift their stats (confidence, form, morale, fan bond), creating a genuine sense of player cultivation over time.

**Core features:**
- 🗺️ **Explore** — GPS-based map with football zones. Open the AR camera to scan for nearby player cards to challenge.
- ⚽ **Penalty Duel** — Tap-based mini-game to recruit players to your squad by winning a penalty shootout.
- 💬 **Train** — AI chat with your collected players using Google Gemini. Each reply is in-character and affects stats.
- ⚔️ **Compete** — Challenge rival managers to matchups. Win to earn XP and climb the leaderboard.
- 📡 **Live Feed** — Real-time match events from around the world that shift your players' morale.
- 🏆 **Leaderboard** — Global rankings updated after every challenge.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Map | Leaflet / react-leaflet |
| AI | Google Gemini (via Vercel serverless) |
| Database | Supabase (PostgreSQL) |
| Deployment | Vercel |
| PWA | Web App Manifest + Service Worker |

---

## Run Locally

### Frontend only

```bash
npm install
npm run dev
```

### Full-stack (frontend + `/api/*` serverless routes)

```bash
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

When `vercel dev` starts, open the local URL shown (typically `http://localhost:3000`).

**Required environment variables:**

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google Gemini API key (server-only) |
| `GEMINI_MODEL` | Optional — defaults to `gemini-2.5-flash` |

---

## Database Setup

Apply `supabase/schema.sql` in the Supabase SQL Editor, then seed data:

```bash
npm run seed:core
```

Verify with:

```bash
curl http://localhost:3000/api/health
```

---

## Build & Deploy

```bash
npm run build
```

Connect the repo to Vercel for continuous deployment. Build command: `npm run build`, output directory: `dist`.

---

## Install on iPhone (PWA)

1. Open the deployed URL in **Safari** over HTTPS.
2. Tap **Share** → **Add to Home Screen**.
3. The app runs in full-screen standalone mode.

---

## API Routes

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Liveness + DB connectivity check |
| `POST` | `/api/chat` | AI player chat (Gemini-backed) |
| `POST` | `/api/duel-line` | Generate in-game duel dialogue |
| `GET` | `/api/zone-flavor` | Zone flavor text |
| `GET` | `/api/live-dialogue` | Live match event line |
| `GET` | `/api/players` | Player roster |
| `GET` | `/api/zones` | Zone data |
| `GET` | `/api/leaderboard` | Global leaderboard |
| `GET` | `/api/user-players` | Owned players for a user |
| `GET` | `/api/discovery/players-nearby` | Nearby hidden prospects |

---

## PWA Icons

Replace placeholder icons with final artwork by overwriting:

| File | Size |
|------|------|
| `public/icons/icon-192.png` | 192×192 |
| `public/icons/icon-512.png` | 512×512 |
| `public/icons/apple-touch-icon.png` | 180×180 |

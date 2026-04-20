# Pocket Pitch Legends

**Team:** Good Bunny  
**Members:** Candice Shen · Daniel Yang · Yiqi Song · Helen Deng  
**Course:** Generative AI and Social Media — Final Project  
**Instructor:** Tauhid Zaman

---

## Try It Now

Scan the QR code with your phone or visit the link below:

<p align="center">
  <img src="./public/qr-code.png" alt="Scan to try Pocket Pitch Legends" width="320" />
</p>

<p align="center"><strong>👆 Scan with your phone camera to open the app</strong></p>

---

## Install on iPhone

For the best experience, add the app to your Home Screen so it runs in full-screen mode — no browser bar, no distractions.

1. Open the app URL in **Safari** (not Chrome)
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** — the app icon appears on your home screen
5. Open it from there — it runs like a native app

> **Note:** Must use Safari on iOS. Chrome and other browsers do not support Add to Home Screen for PWAs on iPhone.

---

## About the Project

Pocket Pitch Legends is a location-based mobile web app that reimagines how football fans experience the 2026 World Cup. Think Pokémon Go meets football — you explore your real city, discover international legends on the map, recruit them through penalty duels, train them with AI-powered conversations, and battle rivals to climb the global leaderboard.

Powered by Google Gemini for in-character AI chat — Mbappé sounds like Mbappé, Bellingham like Bellingham. Every conversation dynamically shifts player stats (Confidence, Form, Morale, Fan Bond) and builds a genuine sense of relationship over time.

**Core features**

| | Feature | Description |
|---|---|---|
| 🗺️ | **Explore** | GPS map of your city with football zones. Tap player markers to challenge them. |
| ⚽ | **Penalty Duel** | Swipe-based mini-game — dive left, center, or right to save the shot and recruit the player. |
| 💬 | **Train** | AI chat with your squad using Gemini. Replies are in-character and affect player stats. |
| ⚔️ | **Compete** | Challenge rival managers to earn XP and climb the leaderboard. |
| 📡 | **Live Feed** | Real-time match events that shift your players' morale. |
| 🏆 | **Leaderboard** | Global rankings updated after every challenge. |

---

## Tech Stack

| Layer | Technology |
|---|---|
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

### Full-stack (with `/api/*` serverless routes)

```bash
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

**Required environment variables**

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google Gemini API key (server-only) |
| `GEMINI_MODEL` | Optional — defaults to `gemini-2.5-flash` |

---

## Database Setup

Apply `supabase/schema.sql` in the Supabase SQL Editor, then seed:

```bash
npm run seed:core
```

---

## Build & Deploy

```bash
npm run build
```

Connect the repo to Vercel. Build command: `npm run build`, output directory: `dist`.

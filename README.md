# Player Cultivation Hub

Vite + React app with PWA support (installable on iPhone and other browsers that support web app manifests).

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Preview the production bundle:

```bash
npm run preview
```

## PWA icons (replace with your artwork)

Placeholder icons use a simple 3×3 pixel grid on `#0b1020`, defined in `public/icons/icon-source.svg`. Regenerate the PNGs on Windows with:

`powershell -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1`

**Files to overwrite when you have final assets**

| File | Size |
|------|------|
| `public/icons/icon-source.svg` | Vector source (also used as the SVG favicon in `index.html`) |
| `public/icons/icon-192.png` | 192×192 |
| `public/icons/icon-512.png` | 512×512 (manifest + maskable) |
| `public/icons/apple-touch-icon.png` | 180×180 (iOS Home Screen) |

## Deploy on Vercel

Connect the repo to Vercel and use the default settings for a Vite project (build command `npm run build`, output directory `dist`). The included `vercel.json` rewrites client-side routes to `index.html` while static files such as `sw.js`, `manifest.webmanifest`, and `icons/` are served from the build output.

## MongoDB connection layer

Serverless API routes live under `api/` for Vercel.

- Connection utility: `api/lib/mongodb.ts`
- Health probe: `GET /api/health`
- Player seed route: `POST /api/seed/players`

Required environment variables:

- `MONGODB_URI`
- `MONGODB_DB` (optional if DB is already encoded in URI)

### Seed players locally

1. Start local dev server:
   - `npm run dev`
2. In another terminal, run:
   - `npm run seed:players`

Optional custom base URL:

- `SEED_BASE_URL=http://localhost:8080 npm run seed:players`

## Install on iPhone (Safari)

1. Open the deployed site in **Safari** (not another browser) over **HTTPS** (e.g. your Vercel URL).
2. Tap the **Share** button (square with an arrow pointing up) in the toolbar.
3. Scroll the share sheet and tap **Add to Home Screen**.
4. Edit the name if you like, then tap **Add**.
5. Open the app from the new home screen icon. It runs in **standalone** mode (full screen, no Safari UI).

**Notes**

- Adding to the Home Screen must be done from Safari on iOS.
- On **iPhone Safari** (not standalone), you may see a small install hint. You can dismiss it; it stays hidden until you clear site data for this origin.
- After installation, updates roll out on the next visit when the new version is online; the service worker caches core assets for faster repeat loads and basic offline resilience.

---

## Backend AI — Track 2

**Track 2** is a **standalone FastAPI** service: the **AI Conversation & Personality Engine** for a World Cup 2026 player cultivation app. The frontend calls **`POST /chat`** with the player’s state and chat history; the service returns an **in-character reply** (via Gemini) and **rule-based attribute deltas** for that turn.

**Why standalone?** Track 3 (shared database, persistence, leaderboards, player CRUD, websockets, etc.) is **not built yet**. This folder is intentionally self-contained so the UI can integrate **now** without waiting on the main backend.

**Out of scope here:** database, auth, leaderboard, generic player APIs, websockets, live events.

---

## API overview

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness: `{ "status": "ok" }` |
| `POST` | `/chat` | One fan message → model reply + `attribute_deltas` |

Interactive docs: **`http://127.0.0.1:8000/docs`** (Swagger UI).

**Errors (non-200):**

- **`400`** — unknown `player_id` (body: `{"detail":{"error":"unknown_player_id","message":"..."}}`).
- **`422`** — request validation failed (e.g. invalid `history` role, `cultivation_state` out of range); FastAPI’s default `detail` shape.

**Logs:** successful `POST /chat` emits one **`INFO`** line (`chat_ok` …); unknown player → **`WARNING`**; Gemini failure with fallback → **`WARNING`**. Skipped malformed history rows (defensive path) → **`WARNING`** from `prompt_builder`.

---

## `POST /chat` contract

### Request (JSON)

| Field | Type | Notes |
|-------|------|--------|
| `player_id` | string | Non-empty. Use a known persona id, e.g. `mbappe`, `messi`, `bellingham`, `son`, `musiala`, `pulisic` (see `src/personas.py`). |
| `message` | string | Non-empty. Latest user/fan message. |
| `cultivation_state` | object | `confidence`, `form`, `morale`, `fan_bond` — each **integer 0–100**. |
| `history` | array | Optional. Items: `{ "role": "user" \| "assistant", "content": "..." }`. |

```json
{
  "player_id": "mbappe",
  "message": "Stay sharp for the next match.",
  "cultivation_state": {
    "confidence": 72,
    "form": 68,
    "morale": 75,
    "fan_bond": 60
  },
  "history": [
    { "role": "user", "content": "How are you feeling?" },
    { "role": "assistant", "content": "Focused. Ready to work." }
  ]
}
```

### Response (JSON)

| Field | Type | Notes |
|-------|------|--------|
| `reply` | string | Plain text player reply (Gemini, with in-character fallback if the model call fails). |
| `attribute_deltas` | object | Per-field **integer deltas** for this message, each clamped to **-8…+8** (rule-based scoring, not from the LLM). |

```json
{
  "reply": "…",
  "attribute_deltas": {
    "confidence": 2,
    "form": 0,
    "morale": 3,
    "fan_bond": 1
  }
}
```

---

## Source layout (what each file does)

| File | Role |
|------|------|
| **`src/app.py`** | FastAPI app: `GET /health`, `POST /chat`. Loads `.env`, builds persona + mood + scores + prompts, calls **`generate_reply`**, returns `ChatResponse`. On Gemini errors, returns a **safe in-character fallback** (no 500). |
| **`src/schemas.py`** | Pydantic models: request/response validation (`CultivationState` 0–100, `AttributeDeltas` -8…8, chat history roles). |
| **`src/personas.py`** | Registry of **player personas** (identity, team, speaking style, etc.) and **`get_persona(player_id)`**. |
| **`src/mood.py`** | **`infer_mood(cultivation_state)`** → dict with labels and tone hints from current stats (deterministic, no LLM). |
| **`src/scoring.py`** | **`compute_attribute_deltas(message, …)`** → small integer deltas from **keyword / phrase rules** (no LLM). |
| **`src/prompt_builder.py`** | **`build_system_prompt`** + **`build_chat_messages`** → OpenAI-style message list for Gemini (system + history + latest user). |
| **`src/llm_client.py`** | **`get_gemini_client()`**, **`generate_reply(messages)`**, **`sanitize_reply_text`** — Google **google-genai** SDK, `GEMINI_API_KEY` from env. |

---

## Setup

All commands assume you are in **`backend-ai`** (this folder).

### 1. Create a virtual environment

```bash
python3 -m venv .venv
```

Activate it:

- **macOS / Linux:** `source .venv/bin/activate`
- **Windows (cmd):** `.venv\Scripts\activate.bat`
- **Windows (PowerShell):** `.venv\Scripts\Activate.ps1`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure `.env`

1. Copy the example file (optional): `cp .env.example .env`
2. Edit **`.env`** in **`backend-ai`** and set:

```bash
GEMINI_API_KEY=your_key_here
```

Optional: `GEMINI_MODEL=gemini-2.5-flash` (default is set in code if unset).

The app loads **`backend-ai/.env`** by path so it still works if you start Uvicorn from another working directory.

**Security:** do not commit `.env` or real keys; keep secrets out of git.

### 4. Run the API locally

```bash
python -m uvicorn src.app:app --reload --host 127.0.0.1 --port 8000
```

Then open **`http://127.0.0.1:8000/docs`**.

### 5. Try `POST /chat` in Swagger

1. Open **`/docs`** → **`POST /chat`** → **Try it out**.
2. Paste a JSON body (use a valid `player_id` from `personas.py`, e.g. `son`).
3. **Execute** — check **`reply`** and **`attribute_deltas`** in the response.

### 6. Run the sample conversation script

With the server running on **`http://127.0.0.1:8000`**:

```bash
python tests/sample_conversations.py
```

It prints three realistic scenarios (different players and states), the request JSON, and the response (`reply` + deltas).

### 7. Quick `curl` checks

```bash
curl -s http://127.0.0.1:8000/health
```

```bash
curl -s -X POST http://127.0.0.1:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"player_id":"mbappe","message":"You got this.","cultivation_state":{"confidence":70,"form":65,"morale":72,"fan_bond":55},"history":[]}'
```

---

## Track 3 note

When the **Track 3** backend exists, you can **keep** this service as a dedicated AI microservice or **merge** its routes into the main app. Until then, treat **`backend-ai`** as the single source for **`/chat`** and **`/health`** for AI features.

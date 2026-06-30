# Conclave — Standalone Deployment

This is the standalone, public-friendly version of Conclave. Unlike the
Claude.ai artifact version, this one:

- Works for **anyone who opens the link** — no Claude.ai account, no sign-in wall.
- Keeps your Groq API key **safely on the server** (in `pages/api/conclave.js`),
  never exposed to the browser or visible in devtools/network tab.
- Runs on **Groq's free tier** — no credit card, no per-token billing for
  hackathon-scale usage.

This matters for hackathon judging: judges can open your link cold and the AI
features work immediately, with no extra step, no paywall, and no cost risk.

## Deploy in ~5 minutes (Vercel — free tier is enough)

1. **Get a free Groq API key**: go to https://console.groq.com → sign up
   with email or Google (no credit card needed) → **API Keys** → **Create
   API Key**. Copy it — it starts with `gsk_`.

2. **Push this folder to GitHub** (skip if you already did this):
   ```bash
   cd conclave-app
   git init
   git add .
   git commit -m "Conclave standalone"
   git branch -M main
   git remote add origin https://github.com/<your-username>/conclave.git
   git push -u origin main
   ```

3. **Deploy on Vercel**:
   - Go to https://vercel.com → New Project → Import your GitHub repo.
   - Vercel auto-detects Next.js — no config needed.
   - Before clicking Deploy, open **Environment Variables** and add:
     - Key: `GROQ_API_KEY`
     - Value: the `gsk_...` key from step 1
   - Click **Deploy**.

4. Vercel gives you a live URL like `https://conclave-yourname.vercel.app` —
   that's the link you put in your hackathon submission.

### Alternative: deploy without GitHub

If you don't want to use GitHub, install the Vercel CLI instead:

```bash
npm install -g vercel
cd conclave-app
vercel
```

Follow the prompts (it will ask to link/create a project), then run:

```bash
vercel env add GROQ_API_KEY
```

paste your key when prompted, then run `vercel --prod` to publish.

## Local testing (optional, before you deploy)

```bash
cd conclave-app
cp .env.example .env.local   # then edit .env.local and paste your real key
npm install
npm run dev
```

Open http://localhost:3000.

## Why Groq instead of a paid API

Groq's free developer tier requires no credit card and has no per-token
billing — it's gated only by rate limits (roughly 30 requests per minute,
generous enough for live demos and judges trying the app). It runs Llama
3.3 70B, a strong open-weight model, on Groq's custom inference hardware,
so responses come back fast. This removes any cost risk during judging:
the app can be tried by as many people as the rate limit allows, at zero
dollars.

If Groq's free tier ever becomes too restrictive for your traffic, the only
change needed is swapping the API call in `pages/api/conclave.js` for
another provider — the rest of the app is provider-agnostic.

## Safety notes

- Because the key lives in the server environment variable, it is **never**
  shipped to the browser, so judges or visitors cannot extract or misuse it.
- If you want to retire the deployment after judging ends, just delete the
  project on Vercel or remove the environment variable.

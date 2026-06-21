# Live Portfolio Tracker

This project is a live stock portfolio dashboard built with Next.js.

It includes:

- A portfolio table with your sample holdings
- Auto-refreshing live prices every 30 seconds
- Current value and profit/loss per holding
- Totals for cash, current value, and total P/L

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy So You Can Access Anywhere

The easiest deploy is Vercel.

1. Push this folder to a GitHub repository.
2. Go to https://vercel.com/new
3. Import your repository.
4. Keep defaults and click Deploy.
5. Open your Vercel URL from any device.

## Why Not GitHub Pages

GitHub Pages is static hosting. This app needs a server endpoint for live quotes and secure API key handling.

- Vercel: supports server routes and encrypted environment variables.
- GitHub Pages: no server runtime, so API keys would be exposed or you must add a separate backend service.

If you really want GitHub Pages, use it only for frontend and host quotes on a separate backend such as Cloudflare Workers, Render, or Railway.

## API Key Setup

For best reliability, use Twelve Data.

1. Copy .env.example to .env.local
2. Set TWELVE_DATA_API_KEY with your key
3. Redeploy (or restart local dev server)

## Portfolio Data

The current holdings are defined in src/app/page.tsx in STARTING_POSITIONS.

You can change ticker, buy price, shares, and initial cash there.

## Notes

- The quote endpoint is in src/app/api/quotes/route.ts.
- It uses Twelve Data when TWELVE_DATA_API_KEY is set.
- It falls back to public quote page parsing when API quotes are unavailable.

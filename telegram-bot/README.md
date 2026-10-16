# PricePulse Myanmar — Telegram Bot

A Telegram bot that lets a **wholesaler update prices by chatting**. The
wholesaler sends a supplier message (Burmese, English or mixed), the bot calls the
PricePulse web app which runs **Gemini extraction**, and returns a **draft** the
wholesaler reviews and confirms. Publishing uses the exact same validation, audit
and notification pipeline as the web app — the bot never writes to the database
directly.

```
Wholesaler ──▶ Telegram bot ──▶ PricePulse web API ──▶ Gemini extraction
                                      │
                                      ├─ stores a PENDING draft
                                      └─ on confirm: updates product, appends
                                         price history, notifies retailers
```

## How it works

- **HTTP only.** The bot is a thin client of the running Next.js app
  (`/api/auth/login`, `/api/prices/extract`, `/api/prices/drafts/:id`,
  `/api/prices/drafts/:id/confirm`). No AI or DB logic is duplicated here.
- **Auth.** `/login <username> <password>` signs in and keeps the session cookie
  **in memory per chat** (never written to disk). The login message is deleted.
- **Review first.** A message produces a draft shown with inline buttons:
  **Publish**, **Change product** (when several products match) and **Cancel**.
  Nothing is published until the wholesaler taps Publish.

## Requirements

- Node.js 18+ (the app itself may require Node 22+).
- The PricePulse web app running and reachable (local `http://localhost:3000`
  or your deployed URL).
- A Telegram bot token from [@BotFather](https://t.me/BotFather).

## Setup

```bash
cd telegram-bot
npm install
cp .env.example .env      # then edit .env
```

`.env`:

```ini
TELEGRAM_BOT_TOKEN=123456789:AA...your-token...
PRICEPULSE_API_URL=http://localhost:3000
DEFAULT_LANG=en
```

Start the bot:

```bash
npm run dev      # watch mode (tsx)
# or
npm start        # one-off
```

Then open your bot in Telegram, send `/start`, and `/login <username> <password>`.

Demo wholesale accounts (from the app's seed data):

| Username            | Password         |
| ------------------- | ---------------- |
| `aung_wholesale`    | `Wholesale#2026` |
| `mandalay_depot`    | `Wholesale#2026` |

## Commands

| Command | What it does |
| ------- | ------------ |
| `/start` | Welcome + quick instructions |
| `/login <username> <password>` | Sign in to PricePulse |
| `/logout` | Sign out |
| `/whoami` | Show the signed-in account |
| `/products` | List your wholesale catalog with prices |
| `/drafts` | List pending price drafts |
| `/lang <en\|my>` | Switch language |
| `/help` | Show help |
| `/price <message>` | Extract a price update from a message |
| _any other text_ | Same as `/price`, e.g. `စားသုံးဆီ ၅၈၀၀ ဖြစ်မယ်` |

## Example

```
You:  မနက်ဖြန် စားသုံးဆီ ၁ လီတာ ၅,၈၀၀ ကျပ် ဖြစ်မည်
Bot:  Price update draft
      Product: Cooking Oil (စားသုံးဆီ)
      Package: 1 Liter
      Unit: bottle
      Current price: 5,000 MMK
      New price: 5,800 MMK
      Effective: 2026-…
      Confidence: 95%
      [✅ Publish] [🔁 Change product] [✖️ Cancel]

You:  (taps Publish)
Bot:  ✅ Published: Cooking Oil (စားသုံးဆီ) 1 Liter
      5,000 → 5,800 MMK
      4 connected retailer(s) notified.
```

## Project layout

```
telegram-bot/
├─ src/
│  ├─ index.ts              entry point (Telegraf, long polling)
│  ├─ config.ts             env configuration
│  ├─ api.ts                PricePulse HTTP client (cookie-aware)
│  ├─ session.ts            per-chat in-memory session store
│  ├─ i18n.ts               English + Burmese messages
│  ├─ keyboards.ts          inline button layouts
│  ├─ format.ts             MMK formatting + HTML-safe draft summary
│  ├─ logger.ts             minimal leveled logger
│  └─ handlers/
│     ├─ commands.ts        /start /login /logout /whoami /products /drafts /lang
│     ├─ price.ts           free text + /price → extract → draft keyboard
│     └─ callbacks.ts       publish / pick product / cancel buttons
├─ .env.example
├─ package.json
└─ tsconfig.json
```

## Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Run with `tsx` in watch mode |
| `npm start` | Run once with `tsx` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start:prod` | Run the compiled build (`node dist/index.js`) |
| `npm run typecheck` | Type-check only |


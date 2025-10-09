# Stackcast Web

Frontend for the Stackcast optimistic-oracle prediction markets dashboard. The app is built with React, Vite, Tailwind v4, shadcn/ui, and Bun.

## Getting started

```bash
bun install
bun run dev
```

Set `VITE_API_BASE_URL` if your backend API is not running at `http://localhost:3000`:

```bash
cp .env.example .env
# edit as needed
```

## Available scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start Vite dev server |
| `bun run build` | Type-check and build for production |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run ESLint (permits shadcn utility exports) |

## Features

- Live market list backed by the Bun/Express API (`/api/markets`)
- Market detail view with synchronized orderbook, trades, and order placement
- Oracle console surfaces backend stats and prepares optimistic-oracle payloads
- Shared API client, request hook with polling, and neutral shadcn theme

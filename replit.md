# StealthFlow

A React + Vite monorepo migrated from Vercel to Replit.

## Project Structure

- `artifacts/stealthflow/` — Main frontend app (Vite + React + Tailwind CSS v4)
- `lib/` — Shared libraries (db, api-zod, api-spec, api-client-react)
- `scripts/` — Utility scripts
- `contracts/` — Smart contract related code

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS v4, Wouter (routing), TanStack Query
- **UI**: Radix UI components, Shadcn-style setup, Framer Motion
- **Web3**: ethers.js v6, cofhejs (FHE)
- **Package Manager**: pnpm (workspace monorepo)

## Running the App

The app runs via the "Start application" workflow:

```
cd artifacts/stealthflow && pnpm run dev
```

Starts Vite dev server on port 5000 (required for Replit webview).

## Replit Configuration

- Dev script uses `--port 5000 --host 0.0.0.0` for Replit compatibility
- Vite config conditionally loads Replit plugins (`@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`) in dev mode when `REPL_ID` is set
- `allowedHosts: true` in Vite server config for Replit's proxy
- Originally deployed on Vercel as a static SPA with SPA rewrites

## Key Files

- `artifacts/stealthflow/vite.config.ts` — Vite configuration
- `artifacts/stealthflow/src/App.tsx` — App entry component
- `artifacts/stealthflow/src/main.tsx` — React DOM render entry
- `pnpm-workspace.yaml` — Monorepo workspace config
- `vercel.json` — Legacy Vercel config (kept for reference)

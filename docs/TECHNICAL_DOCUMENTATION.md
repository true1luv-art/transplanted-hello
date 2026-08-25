# Technical Documentation

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend framework | TanStack Start v1 |
| UI Library | React 19 |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| State | Zustand |
| Components | shadcn/ui |
| Routing | TanStack Router |
| Backend runtime | Node.js (plain `http` server, run with `tsx`) |
| Database | MongoDB via Mongoose |
| Blockchain | Hive (dHive RPC) + Hive Engine read API |
| Testing | Vitest |

## Runtimes

This repository contains **three processes**:

| Process | Command | Purpose |
| --- | --- | --- |
| Frontend | `bun run dev` / `bun run build` | TanStack Start app on port 8080. No DB access. |
| API service | `npm run server:api` | Node HTTP API on `API_PORT` (4000). Owns MongoDB. |
| Worker | `npm run server:smart-contract` | Polls `transactions_pending` and settles on Hive. |

The frontend reaches the API over HTTPS using `VITE_API_BASE_URL`. Only the API service and the worker open a MongoDB connection, so MongoDB stays on a private network and is never exposed publicly.

## Project Setup

```bash
bun install
bun run dev            # frontend, http://localhost:8080

# in separate terminals, on the machine that can reach MongoDB:
npm run server:api                  # http://localhost:4000
npm run server:smart-contract
npm run server:script-check-backend # verifies config + DB connectivity
```

## Available Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the frontend dev server |
| `bun run build` | Production build of the frontend |
| `bun run test` | Run the Vitest suite |
| `bun run lint` | Run ESLint |
| `npm run server:api` | Start the standalone API service |
| `npm run server:smart-contract` | Start the transaction worker |
| `npm run server:script-check-backend` | Check config + MongoDB connectivity |

## Configuration

Every environment value is read exactly once, in `src/lib/config/config.ts`. **No other file reads `process.env` directly.**

Key environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `mongodb://127.0.0.1:27017` | Mongo connection string (self-hosted VPS or Atlas) |
| `DATABASE_NAME` | `hivemint` | Logical database name |
| `API_PORT` | `4000` | Port for the API service |
| `VITE_API_BASE_URL` | — | Base URL the frontend calls (client-side, `VITE_` prefixed) |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` \| `silent` |
| `AUTO_SEED` | `true` | Seed on empty database (development only) |
| `BLOCKCHAIN_DRIVER` | `mock` | `mock` \| `hive` |
| `HIVE_RPC_NODES` | `https://api.hive.blog` | Comma-separated RPC list |
| `HIVE_NETWORK` | `mainnet` | `mainnet` \| `testnet` |
| `HIVE_ACCOUNT` | — | Account the backend broadcasts from |
| `HIVE_ACTIVE_KEY` | — | **Server-only** signing key. Never `VITE_`-prefixed. |
| `HIVE_BROADCAST_ENABLED` | `false` | Allow real broadcasts |
| `HIVE_ENGINE_API` | `https://api.hive-engine.com/rpc` | Read-only NFT market queries |
| `PLATFORM_ACCOUNT` / `MARKET_ACCOUNT` | `hivemint` / `hivemint-market` | Fee recipients |
| `NFT_CREATION_COST_PER_MINT` | `0.1` | HIVE per mintable slot |
| `PLATFORM_MINT_FEE_PERCENT` | `5` | Platform cut of a mint |
| `MARKETPLACE_FEE_PERCENT` | `2.5` | Platform cut of a sale |
| `SMART_CONTRACT_POLL_INTERVAL_MS` | `1500` | Worker poll interval |
| `SMART_CONTRACT_MAX_ATTEMPTS` | `3` | Attempts before dead-lettering |

`getConfigDiagnostics()` validates the backend configuration and reports **presence only** — keys and connection strings are never included in its output. It backs `GET /health` and `server:script-check-backend`.

## Database

### Connection

`src/lib/config/database.ts` owns a Mongoose singleton cached on `globalThis`, so the connection survives hot reloads and is shared by the API service, worker and scripts in the same process.

```ts
await connectDatabase();   // idempotent; called by every repository
```

Options: `bufferCommands: false` (fail fast instead of queueing against an unreachable server), `serverSelectionTimeoutMS: 5000`, `autoIndex: true`, `dbName` from config.

Also exported:

- `toUpdate(patch)` — splits a partial patch into `$set` / `$unset` so an explicit `undefined` clears a field
- `isDuplicateKeyError(error)` — unique-index violation (code `11000`)
- `checkDatabaseConnection()` — pings and lists collections without throwing
- `closeDatabase()` — graceful shutdown for scripts

There is **no memory driver** and no `Database` interface any more; MongoDB is the only driver.

### Collections

- `users` — Hive accounts. `{ id, username, role, ledgerBalance, timestamps }`. Profile data and liquid HIVE balance are **not** stored; they are read from chain at runtime and the avatar is derived from the username.
- `nft_collections`
- `nfts` — minted tokens only, with cached market state
- `nft_assets` — unminted mintable rows
- `activity`
- `transactions_pending`
- `transactions_processed`

Each has exactly one folder under `src/lib/modules/` containing `types.server.ts`, `model.server.ts` and `repository.server.ts`. Trait layers and generated-trait logic are not collections — they live under `src/features/lib/traits`.

There is no `marketplace_listings` collection: a listing is cached on the NFT document (`isListed`, `listingPrice`, `listingCurrency`, `listingSeller`, `listedAt`, `listingTransactionId`, `marketSyncedAt`) and revalidated with `fetchHiveListing()` in `src/lib/chain/market.ts`.

### Repositories

`BaseRepository` in `src/lib/config/repository.ts` is a thin typed layer over a Mongoose model: generic CRUD plus `IndexSpec` declarations. Domain queries live in the module repositories, never in the base class. All documents carry an application-owned string `id`.

## API Service

```text
src/server/api/
├── index.ts                 # process entry: node http server, port API_PORT, graceful shutdown
├── app.ts                   # createApp(): cors -> request logger -> router -> error mapping
├── routes/
│   ├── index.ts             # createApiRouter() registers every group
│   ├── health.routes.ts     # /health, /stats, /events, /creation-cost
│   ├── collections.routes.ts
│   ├── nfts.routes.ts
│   ├── listings.routes.ts
│   ├── activity.routes.ts
│   ├── users.routes.ts
│   ├── transactions.routes.ts
│   └── admin.routes.ts
├── middleware/
│   ├── cors.ts
│   ├── request-logger.ts
│   └── auth.ts              # requireAuth / optionalAuth (Bearer)
├── lib/
│   ├── router.ts            # tiny path/param router
│   ├── errors.ts            # ApiError + JSON error mapping
│   ├── respond.ts           # response envelope helpers
│   ├── request.ts           # body/query parsing
│   ├── context.ts           # per-request context
│   ├── actor.ts             # resolves the acting Hive username
│   ├── bootstrap.ts         # connect DB + optional auto-seed on start
│   ├── stats.ts, transaction.ts, diagnostics.ts, logger.ts
└── schemas/index.ts         # zod request schemas
```

### Adding an endpoint

1. Add the zod schema in `schemas/index.ts`.
2. Add the handler in the matching `*.routes.ts` (`router.get/post(path, handler)`).
3. Use `requireAuth(request)` when the route mutates data.
4. Return through `respond.ts` so the envelope stays consistent.
5. Throw `ApiError` subclasses from `lib/errors.ts`; the dispatcher maps them.

### Auth

`Authorization: Bearer <token>`. Today the token is the Hive username (dev fallback in `middleware/auth.ts`). Replacing it with Hive Keychain signature verification is a change inside `requireAuth` only — no route changes.

## Frontend

### Routing

File-based under `src/routes/`:

- `__root.tsx` — root layout
- `index.tsx` — landing page
- `collections.index.tsx`, `collections.$id.index.tsx`, `collections.$id.activity.tsx`
- `nfts.$id.tsx`
- `$username.nfts.tsx`, `$username.creator.tsx` — public profile pages (`/@user/nfts`, `/@user/creator`); the owner sees action buttons, visitors get a view-only badge
- `mint.$collectionId.tsx`, `generate.tsx`, `activity.tsx`

Each content route defines `head()` with a unique title, description, Open Graph tags and Twitter card.

### Server functions

`createServerFn` from `@tanstack/react-start` remains available for frontend-local server work (SSR helpers, proxying). It is **not** where database access belongs — that lives in the API service.

Rules that still apply:

- Read `process.env` inside the handler, never at module scope.
- Keep server-function modules thin wrappers.
- Never import a `.server.ts` module or `mongoose` from frontend code.

## Deployment

1. Provision MongoDB on the VPS, bound to localhost or a private interface.
2. Deploy the repo to the VPS; set `DATABASE_URL`, `DATABASE_NAME`, `API_PORT` and the Hive variables.
3. Run `npm run server:script-check-backend` to confirm config and connectivity.
4. Start `server:api` and `server:smart-contract` under a process manager (systemd / pm2).
5. Put a reverse proxy with TLS in front of the API.
6. Build the frontend with `VITE_API_BASE_URL` pointing at that public API URL.

MongoDB itself should never be reachable from the public internet — only the API service talks to it.

## Key Files Reference

| File | Purpose |
| --- | --- |
| `src/router.tsx` | TanStack Router configuration |
| `src/routes/__root.tsx` | Root layout and global providers |
| `src/lib/config/config.ts` | All environment reads + fee math + diagnostics |
| `src/lib/config/database.ts` | Mongoose connection singleton and helpers |
| `src/lib/config/repository.ts` | Base repository over Mongoose |
| `src/lib/config/logger.ts` | Structured logging |
| `src/lib/chain/market.ts` | Hive Engine listing reads |
| `src/lib/chain/amounts.ts` | Integer-safe milli-unit Hive math |
| `src/server/api/index.ts` | API service process entry |
| `src/server/api/app.ts` | Request dispatcher |
| `src/server/smart-contract/main.ts` | Worker process entry |
| `src/server/smart-contract/workers/transaction-worker.ts` | Leasing, verification, retries, dead-lettering |
| `src/server/smart-contract/services/verification.service.ts` | Independent Hive transaction verification |
| `src/server/smart-contract/services/expectations.ts` | Request → expected on-chain operation |
| `src/server/smart-contract/services/payouts.service.ts` | Idempotent leg-by-leg payouts |
| `src/server/scripts/check-backend.ts` | Config + connectivity check |
| `src/server/scripts/seed.ts` | Seed data |
| `src/features/stores/app-store.ts` | Global Zustand facade |

## Common Tasks

### Adding a feature action

1. Create `src/features/events/<action-name>/`.
2. Add `action.ts` with a typed exported function and `test.ts`.
3. Add types to `src/features/types/` if needed.
4. Wire it into the component or store facade.

### Adding a module (collection)

1. Create `src/lib/modules/<name>/`.
2. Add `types.server.ts`, `model.server.ts` (Mongoose schema + indexes + view mappers) and `repository.server.ts`.
3. Expose it through a route in `src/server/api/routes/`.

## Notes

- The frontend still runs largely on mock data (Zustand + mock keychain/blockchain/IPFS) while it is migrated onto the HTTP API.
- All mock blockchain results are flagged `mock: true` so the UI can label them.
- Constants shared between modules and features live in `src/lib/constants.ts` to avoid dependency violations.

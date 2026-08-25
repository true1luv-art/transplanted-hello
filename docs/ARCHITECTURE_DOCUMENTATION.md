# Architecture Documentation

## Overview

HiveX NFTs is an NFT launchpad and marketplace built around the Hive ecosystem. Creators generate or import collections, mint assets, list them on a marketplace, and the backend settles those operations against Hive.

The system is **two runtimes, one repository**:

- a **frontend** (TanStack Start / React) that renders the UI and talks to the backend over HTTPS, and
- a **backend** (plain Node.js) that owns MongoDB via Mongoose, exposes an HTTP API, and runs the smart-contract transaction worker.

The frontend has no database dependency. The backend has no React dependency. They meet at a single HTTP boundary.

## Architectural Principles

1. **One runtime boundary** — the browser/edge frontend never opens a database connection. All persistence goes through the API service over HTTP.
2. **Layered boundaries** — UI components never talk to repositories. They dispatch through feature actions and the API client.
3. **Domain-driven modules** — each domain (users, collections, nfts, nft-assets, activity, transactions) owns its own types, model and repository.
4. **Server-only by filename** — every persistence file ends in `.server.ts`. Client-safe domain types live under `src/features/types/domain/`.
5. **Hive is authoritative** — the database indexes and caches chain state; it never becomes the source of truth for identity, balances or ownership.
6. **Action-oriented features** — every meaningful user operation is a feature action with a matching test file.

## Deployment Topology

```text
┌──────────────────────────────┐        HTTPS         ┌────────────────────────────┐
│  Frontend (TanStack Start)   │  ──────────────────► │  API service (Node.js)     │
│  React 19 + Vite + Zustand   │   VITE_API_BASE_URL  │  src/server/api            │
│  edge or node hosting        │ ◄──────────────────  │  port 4000                 │
└──────────────────────────────┘                      └─────────────┬──────────────┘
                                                                    │ Mongoose (TCP)
                                                      ┌─────────────▼──────────────┐
                                                      │  MongoDB (VPS or Atlas)    │
                                                      └─────────────▲──────────────┘
                                                                    │
                                                      ┌─────────────┴──────────────┐
                                                      │  Smart-contract worker      │
                                                      │  src/server/smart-contract  │
                                                      │  polls transactions_pending │
                                                      └─────────────┬──────────────┘
                                                                    │ dHive RPC
                                                      ┌─────────────▼──────────────┐
                                                      │  Hive blockchain            │
                                                      └────────────────────────────┘
```

The API service and the worker are separate processes that share the same Mongoose connection code and the same module repositories. Both run on the machine that can reach MongoDB — typically the same VPS, so MongoDB never needs to be exposed to the public internet.

## High-Level Layers

```text
┌─────────────────────────────────────────────┐
│  Presentation (React components + routes)   │
├─────────────────────────────────────────────┤
│  Features (actions + stores + API client)   │
╞═════════════ HTTP boundary ═════════════════╡
│  API service (routes + middleware + lib)    │
├─────────────────────────────────────────────┤
│  Modules (Mongoose models + repositories)   │
├─────────────────────────────────────────────┤
│  Infrastructure (MongoDB, Hive RPC, IPFS)   │
└─────────────────────────────────────────────┘
```

### Dependency Direction

Dependencies point strictly downward, and nothing crosses the HTTP boundary by import:

- `src/routes/*` and `src/components/*` depend on `src/features/*`
- `src/features/*` depend on client-safe types and the API client
- `src/server/api/*` depends on `src/lib/modules/*` and `src/lib/config/*`
- `src/lib/modules/*` depend on `src/lib/config/*` only
- `src/lib/modules/*` must **not** depend on `src/features/*`
- **no** frontend file may import a `.server.ts` module or `mongoose`

Shared constants live in `src/lib/constants.ts` so both sides can reference them without creating cycles.

## Directory Structure

```text
src/
├── components/           # React UI components
├── routes/               # TanStack Start routes (frontend only)
├── features/             # Application layer (frontend)
│   ├── stores/           # Zustand facades (app-store.ts, generator-store.ts)
│   ├── events/           # one folder per user action (action.ts + test.ts)
│   ├── lib/              # generator, import pipeline, storage, traits, marketplace
│   ├── mocks/            # mock keychain, blockchain, IPFS
│   └── types/            # client-safe application + domain types
├── lib/
│   ├── modules/          # one folder per MongoDB collection (server-only)
│   │   ├── users/
│   │   ├── collections/
│   │   ├── nfts/
│   │   ├── nft-assets/
│   │   ├── activity/
│   │   ├── transactions-pending/
│   │   └── transactions-processed/
│   ├── config/           # config.ts, database.ts, repository.ts, logger.ts, helpers.ts
│   ├── chain/            # Hive RPC + market reads
│   └── constants.ts
└── server/               # Node.js runtime only — never imported by the UI
    ├── api/              # standalone HTTP API service
    │   ├── index.ts      # process entry (node http server, port API_PORT)
    │   ├── app.ts        # request dispatcher: cors -> logger -> router
    │   ├── routes/       # one file per resource
    │   ├── middleware/   # cors.ts, request-logger.ts, auth.ts
    │   ├── lib/          # router, errors, logger, context, respond, request, stats
    │   └── schemas/      # zod request schemas
    ├── smart-contract/   # blockchain drivers, verification, transaction worker
    └── scripts/          # seed.ts, check-backend.ts
```

## Database

MongoDB via **Mongoose**. There is no driver abstraction and no memory driver — the previous `Database`/`MemoryCollection` interface has been removed.

- `src/lib/config/database.ts` — connection singleton cached on `globalThis` (survives hot reload, shared by API + worker + scripts), with `bufferCommands: false` so an unreachable server fails fast instead of queueing. Also exports `toUpdate()` (partial patch → `$set`/`$unset`), `isDuplicateKeyError()`, `closeDatabase()` and `checkDatabaseConnection()`.
- `src/lib/config/repository.ts` — a thin typed base over a Mongoose model: generic CRUD plus index declaration. Domain queries live in the module repositories, not here.

Every repository call awaits `connectDatabase()` first.

### Collections

`users`, `nft_collections`, `nfts`, `nft_assets`, `activity`, `transactions_pending`, `transactions_processed`.

Each maps to exactly one folder under `src/lib/modules/`, containing exactly three files:

- `types.server.ts` — document shape and inputs
- `model.server.ts` — Mongoose schema, collection name, indexes, factories, view mappers
- `repository.server.ts` — data access

Trait layers, trait values, generated traits and rarity math are **not** collections — they live under `src/features/lib/traits` and `src/features/lib/generator`.

There is **no marketplace collection**. Hive owns the market; listing state is cached on the NFT document.

## Modules

### Users

Indexes Hive accounts. The Hive account name (`username`) **is** the identity — no wallet address, no Ethereum-style address model.

The document is deliberately thin: `{ id, username, role, ledgerBalance, createdAt, updatedAt }`. Display name, avatar, banner, about and the liquid HIVE balance are **not** stored — they are read from the chain at runtime (`src/lib/chain/`), with the avatar derived as `https://images.hive.blog/u/{username}/avatar`. `ledgerBalance` is app-owned simulated credit used by the mock settlement path and has no chain meaning.

### Collections

Collection metadata, deployment state, supply constraints and volume.

### NFT lifecycle

```text
collections -> nft_assets (unminted) -> verified Hive mint -> nfts (minted index)
```

- `nft_assets` is the pool of UNMINTED NFTs — everything needed to mint one token (IPFS references, metadata, traits, rarity). Minting atomically reserves a row; the row is deleted only after the mint is verified and indexed.
- `nfts` indexes MINTED tokens only: owner, `hiveNftId` (`SYMBOL:tokenId`), mint/Hive transaction ids, metadata reference and cached market state (`isListed`, `listingPrice`, `listingSeller`, `listedAt`).

### Marketplace state

A "listing id" is simply the NFT id. Cached fields (`isListed`, `listingPrice`, `listingCurrency`, `listingSeller`, `listedAt`, `listingTransactionId`, `marketSyncedAt`) can always be revalidated from chain with `fetchHiveListing()` in `src/lib/chain/market.ts`.

### Activity

Append-only event log (mint, sale, transfer, listing) indexed by actor, collection and NFT, powering the global, per-collection and per-user feeds.

### Transactions

Split into `transactions_pending` (claimed and processed by the worker) and `transactions_processed` (final results).

## API Service

`src/server/api` is a standalone Node.js HTTP service — no TanStack, no Vite, no React. It is started by `npm run server:api` and listens on `API_PORT` (default 4000).

Request flow:

```text
node http server (index.ts)
  └─ createApp() (app.ts)
       ├─ cors middleware
       ├─ request logger (method, path, status, duration)
       └─ router (lib/router.ts)  → route handler → repository → MongoDB
            └─ errors.ts maps thrown ApiError/ZodError to a JSON envelope
```

`middleware/auth.ts` exposes `requireAuth` / `optionalAuth`, reading a `Bearer` token. Today the token is the Hive username (dev fallback); Keychain-signature verification replaces that body without changing any route.

### Endpoints

| Group | Endpoints |
| --- | --- |
| Health | `GET /health`, `GET /stats`, `GET /events`, `GET /creation-cost` |
| Collections | `GET /collections`, `GET /collections/:id`, `POST /collections`, `GET /collections/:id/nfts`, `/assets`, `/inventory`, `/listings`, `/activity`, `POST /collections/:id/mint` |
| NFTs | `GET /nfts`, `GET /nfts/:id`, `GET /nfts/:id/activity`, `GET /nfts/:id/listing`, `POST /nfts/:id/list`, `POST /nfts/:id/transfer` |
| Listings | `GET /listings`, `GET /listings/:id`, `POST /listings/:id/buy`, `POST /listings/:id/cancel` |
| Activity | `GET /activity` |
| Users | `GET /users/:username`, `GET /users/:username/balance`, `POST /users/ensure` |
| Transactions | `GET /transactions`, `GET /transactions/recent`, `GET /transactions/:id` |
| Admin | `GET /admin/queue`, `POST /admin/tick`, `POST /admin/reset`, `POST /tick`, `POST /reset` |

Every response uses the same envelope produced by `lib/respond.ts`.

## Features

Features are the entry point for user intent. Each feature action validates input, coordinates the API client, updates stores, and has a matching `test.ts`.

Examples: `create-collection`, `import-collection`, `generate-nfts`, `mint-nft`, `list-nft`, `buy-nft`, `cancel-listing`, `transfer-nft`, `connect-wallet`, `export-nfts`, `reset-demo-data`.

## State Management

- `src/features/stores/app-store.ts` — global application state (collections, NFTs, listings, activity, wallet session)
- `src/features/stores/generator-store.ts` — generative studio state

Stores expose read selectors and thin write methods; domain logic lives in feature actions.

## Smart-Contract Worker

`src/server/smart-contract/` runs as its own process (`npm run server:smart-contract`) and never appears in UI code.

The worker handles `TRANSFER_NFT`, `LIST_NFT`, `BUY_NFT` and `CANCEL_LISTING` after verification, always re-validating against the MongoDB index rather than the client payload:

- **Transfer** — the authoritative sender is the indexed owner; a mismatched declared sender is a terminal failure. Any cached listing is cleared before ownership moves.
- **List** — requires positive price and indexed ownership; relisting an already-listed NFT is rejected. The application transaction id is stored as `listingTransactionId`, so a replay resolves to existing state.
- **Buy** — price and fee come from the indexed listing; balance is checked, payout is distributed leg by leg (seller, then platform), the cached listing is cleared, ownership moves, collection volume updates.
- **Cancel** — seller-only; clears the cached listing without touching ownership.

All four paths are idempotent: replays resolve to existing state and payout legs are persisted before the next leg runs, so a restart never pays twice. Coverage lives in `src/server/smart-contract/marketplace.test.ts`.

Mint settlement uses `MintPayoutService`: integer milli-unit splitting, per-leg persistence, `reserveMint`/`releaseMint` so `maxSupply` can never be overrun. Payout failures are transient (retried); business-rule failures are terminal (dead-lettered).

The driver is selected by `BLOCKCHAIN_DRIVER` (`mock` | `hive`).

## Generative Art Engine

`src/features/lib/generator/` composes layered trait images: `engine.ts` (orchestration), `compose.ts` (composition), `metadata.ts`, `naming.ts`, `validate.ts`, `batching.ts`. Traits and rarity live in `src/features/lib/traits/`.

## Import Pipeline

`src/features/lib/import/` supports ZIP batch imports: `zip.ts` / `zip-batch.ts` (extraction), `parse.ts`, `derive.ts`, `image-match.ts`, `rarity.ts`, `pipeline.ts`.

## Storage

Asset storage is abstracted behind `src/features/lib/storage/storage.ts`. Today it uses a mock IPFS layer (`src/features/mocks/mock-ipfs.ts`) returning gateway-style URIs; a real pinning service (Pinata/Kubo/Filebase) drops in behind the same interface.

## Testing Strategy

- Unit tests sit next to the code they test as `test.ts`.
- Vitest is the runner.
- Feature actions, module models and the marketplace/verification worker paths are tested in isolation.

## Future Evolution

- Replace the dev bearer token with real Hive Keychain signature verification.
- Replace `MockBlockchainService` with `HiveBlockchainService` for mainnet broadcasts (`BLOCKCHAIN_DRIVER=hive`).
- Replace mock IPFS with a real pinning provider.
- Migrate the remaining Zustand mock reads onto the HTTP API client.

# Standalone API service + Mongoose backend

Split the project into two runtimes that share one repo:

- **Frontend** — TanStack Start on the edge Worker. Talks to the API over HTTPS only.
- **API service** — plain Node (`bun run api`), Mongoose + MongoDB, hosted on your VPS.
- **Smart-contract worker** — already its own Node process; moves onto the same Mongoose connection.

```text
browser ──https──> API service (VPS, Node)  ──> MongoDB
   │                      ▲
   └── TanStack SSR ──────┘   (server-to-server, same HTTPS URL)
```

## 1. New server layout

```text
src/server/api/
  index.ts            entry point — reads config, builds the app, listens on API_PORT
  app.ts              route table assembly + 404/error terminator
  routes/
    health.routes.ts        /health, /stats, /diagnostics, /creation-cost
    collections.routes.ts   list/detail/nfts/inventory/assets/listings/activity, create, mint
    nfts.routes.ts          detail, listing, activity, list, transfer
    listings.routes.ts      browse, detail, buy, cancel
    activity.routes.ts      activity feed + events
    users.routes.ts         profile reads
    transactions.routes.ts  pending, recent, by-hash
    admin.routes.ts         tick, reset, seed (guarded)
  middleware/
    cors.ts             allow-list of frontend origins + OPTIONS preflight
    auth.ts             Bearer JWT -> req.actor (Hive username); requireAuth guard
    validate.ts         Zod body/params/query validation -> 400 with details
    error-handler.ts    ApiError/ZodError/unknown -> uniform JSON envelope
    request-logger.ts   method, path, status, duration, request id
  lib/
    errors.ts           ApiError + badRequest/unauthorized/notFound/conflict helpers
    logger.ts           API-scoped logger built on lib/config/logger
    respond.ts          json()/created()/noContent() helpers
    router.ts           tiny method+pattern matcher (no Express dependency)
  schemas/              Zod schemas, one file per domain
```

`src/server/api/router.ts` (532 lines of nested `if`/`switch`) is dissolved into the
`routes/` files. `http.ts` splits into `lib/errors.ts` + `lib/respond.ts`.
`diagnostics.ts` moves under `routes/health.routes.ts`.

`package.json` scripts:

```json
"server:api": "tsx watch src/server/api/index.ts",
"server:api:start": "tsx src/server/api/index.ts",
"server:smart-contract": "tsx src/server/smart-contract/main.ts",
"server:script-seed": "tsx src/server/scripts/seed.ts",
"server:script-check-backend": "tsx src/server/scripts/check-backend.ts"
```

## 2. Mongoose replaces the memory driver

- `src/lib/config/database.ts` → cryptocore's singleton: `connectDatabase()` caching
  `global._mongooseConnection`, `bufferCommands: false`, `dbName` from config. The
  `Database`/`DbCollection`/`MemoryDatabase` abstraction is deleted.
- `src/lib/config/repository.ts` → deleted. `BaseRepository` hides the atomic
  operators we actually need.
- Each `src/lib/modules/<x>/`:
  - `types.server.ts` — interface extends mongoose `Document`
  - `model.server.ts` — `new Schema(...)` with indexes declared inline, exported via
    `mongoose.models["X"] ?? mongoose.model("X", schema)`
  - `repository.server.ts` — exported async functions, each `await connectDatabase()`
    first, returning `.lean<T>()`
- Atomic operations this unlocks (all currently racy read-modify-write):
  - `ledgerBalance` debit/credit via `$inc` with a guard filter
  - pending-transaction claim via `findOneAndUpdate({ status: 'pending' }, ..., { new: true })`
  - duplicate `txHash` handled by unique index + error code `11000`
- `.data/hivemint.json` snapshot and `config.databaseFile` are removed;
  `DATABASE_URL` becomes required for the API and worker.
- `src/server/scripts/seed.ts` becomes `bun run server:script-seed`, run against Mongo
  explicitly — no more auto-seed on first request.
- `src/server/scripts/check-backend.ts` becomes `bun run server:script-check-backend`.

## 3. Frontend talks HTTP only

- New `src/lib/api/client.ts`: `apiFetch(path, init)` resolving the base URL from
  `import.meta.env.VITE_API_BASE_URL` in the browser and `process.env.API_BASE_URL`
  during SSR, attaching the session JWT and unwrapping the `{ error }` envelope.
- Route loaders and Zustand actions call `apiFetch`, never a repository.
- `src/routes/api/$.ts` is deleted — the Worker no longer hosts the API.
- Hard rule enforced by a lint check: nothing under `src/routes/**` or
  `src/features/**` may import `src/lib/modules/**`, `src/server/**`, or
  `src/lib/config/database.ts`.

## 4. Auth across the boundary

Keychain signature → `POST /auth/login` on the API → JWT (Hive username as subject)
→ stored client-side → `Authorization: Bearer` on every mutating call. The API is
the only place that trusts the token; `config.devUser` fallback is removed once this
lands.

## Sequencing

1. Scaffold `src/server/api/{index,app,lib,middleware}` and port `health` + `collections`
   routes to prove the shape; keep the old router alive behind it.
2. Port the remaining route groups, then delete `router.ts`/`http.ts`/`diagnostics.ts`.
3. Swap `database.ts` to Mongoose, rewrite each module's model/repository, delete
   `repository.ts`, update the worker and tests.
4. Add `src/lib/api/client.ts`, migrate frontend reads, delete `src/routes/api/$.ts`.
5. Add the import-boundary lint rule and update the architecture docs.

## Notes

- Steps 1–2 are pure restructuring; the app keeps working on the memory driver
  throughout, so nothing breaks mid-migration.
- Step 3 is the breaking one: it needs a reachable `DATABASE_URL` before the API or
  worker will start.
- Public collection/NFT pages keep SSR loaders (SEO); wallet-scoped pages fetch
  client-side so the frontend stays up if the VPS blips.

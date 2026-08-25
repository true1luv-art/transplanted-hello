# Reference Architecture Documentation

Source: `reference/` — a plain-file copy of `github.com/rhiaji/cryptocoresol-app`
("CryptoCore", a Solana-token idle/raid game). This document describes **how that
codebase is organized**, so its structure can be used as the blueprint for the next
HiveMint folder reorganization. Nothing here describes HiveMint's current code.

---

## 1. Stack of the reference app

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC + `"use client"` islands) |
| UI | React 19, Tailwind v4, shadcn/ui, framer-motion, recharts |
| Data fetching | TanStack Query + SWR, plus a hand-written fetch client |
| Client state | Zustand (with `persist` middleware) |
| Database | MongoDB via Mongoose 9 |
| Auth | Wallet signature challenge → JWT (`jose`), Bearer token |
| Chain | Solana (`@solana/web3.js`, `spl-token`, `bs58`, `tweetnacl`) |
| Background work | Standalone `tsx` worker process (`server/game-smart-contract`) |
| Validation | Zod 4 |

Key point: it is **not** a single-process app. There is (a) the Next app and
(b) a separately-launched settlement worker, both sharing the same `lib/` code
through the `@/*` path alias (`tsconfig.json` maps `@/*` → repo root).

---

## 2. Top-level folder map

```text
reference/
  app/                     # Next.js App Router: routes + HTTP API only
    (game)/                # route group for authenticated game screens
      dashboard/page.tsx
      inventory/page.tsx
      chests/page.tsx
      shop/page.tsx
      profile/page.tsx
      layout.tsx           # pass-through group layout
    marketplace/page.tsx
    wiki/page.tsx
    page.tsx               # landing
    not-found.tsx
    layout.tsx             # root layout (fonts, metadata)
    providers.tsx          # QueryClientProvider + AppShell + Toaster
    globals.css
    api/**/route.ts        # 34 HTTP endpoints (see §4)

  features/                # domain layer that the UI is allowed to import
    constants/             # game.ts (all tunables), nav.ts
    game/                  # PURE domain math (no I/O, no React)
    pages/                 # one component per route = the actual screen
    stores/                # Zustand stores (client state + API calls)
    templates/             # static content catalogs (avatars, banners, gear)
    types/                 # shared domain types (game.ts)

  components/              # presentational React only
    ui/                    # shadcn primitives (~45 files)
    layout/                # AppShell, SidebarNav, PageHeader, dropdowns
    game/                  # game widgets & modals (~26 files)
    auth/                  # ConnectGate, ConnectWalletModal
    brand/                 # BrandLogo, TokenIcon

  hooks/                   # cross-cutting React hooks (useGameStats, useMiningTick, …)

  lib/                     # infrastructure + server logic
    config/                # config.ts (only env reader), database.ts (mongoose singleton)
    modules/<collection>/  # ONE folder per MongoDB collection (see §3)
    game/*.server.ts       # server-side game services (claim, raid, chest, …)
    api/                   # auth.ts, cors.ts, client.ts, dto.ts, types.ts
    auth/                  # jwt.ts, login.server.ts
    chain/solana/          # client, transfer, verify, verify-deposit
    format.ts icons.ts notify.ts utils.ts error-*.ts logs-format.ts wallet.ts

  server/game-smart-contract/   # standalone worker process (never imported by app)
    index.ts                    # entry: connect DB, start worker, signal handling
    workers/transaction-worker.ts
    lib/transfers.ts lib/logger.ts

  public/                  # static assets (large: art/templates)
```

---

## 3. `lib/modules/` — one folder per MongoDB collection

This is the strictest rule in the reference codebase. A folder exists **only** if a
real collection exists. Present collections:

`assets`, `game-stats`, `items`, `login-nonces`, `players`,
`templates`, `transactions-pending`, `transactions-processed`.

Every module has exactly three files, all suffixed `.server.ts` (server-only by
filename, so bundler import protection keeps them out of client bundles):

| File | Contents |
| --- | --- |
| `types.server.ts` | `I<Entity> extends Document` interface + nested sub-interfaces (`IMilestones`, `IProfile`, `IEquipment`) |
| `model.server.ts` | Mongoose `Schema` + sub-schemas + compiled model, indexes, defaults |
| `repository.server.ts` | All queries as **plain exported functions** — no classes |

Extras are allowed when they are collection-specific:
`assets/mint-defaults.server.ts` (mints soulbound default cosmetics).

Repository conventions worth copying:

- Every function starts with `await connectDatabase()` — connection is lazy and
  idempotent, not injected.
- Reads use `.lean<IPlayer>()` so callers get plain objects.
- Money/counters mutate through atomic operators only:
  `updateOne({ wallet, hash: { $gte: amount } }, { $inc: { hash: -amount } })`
  and the caller checks `modifiedCount > 0` for success. This is the guard-and-debit
  idiom used everywhere instead of read-modify-write.
- Writes are **scoped `$set` patches** (`tickPatch(player)`), never full-document
  saves, so concurrent `$inc`s from other endpoints are not stomped.

Known gap: several files import `@/lib/modules/logs/repository.server`
(`createLog`, `createErrorLog`) but that module folder is **absent** from the
snapshot. If this structure is adopted, a `logs` collection module must be created.

---

## 4. `app/api/**/route.ts` — the HTTP surface

34 endpoints, grouped by domain:

```text
auth/challenge, auth/verify                 # wallet nonce → JWT
player/me, player/referrals
items, items/equip, items/unequip, items/salvage
assets, assets/equip, assets/unequip
templates
market, market/list, market/buy, market/cancel
game/claim, game/tick, game/chest, game/burn, game/raid, game/raid/targets,
game/upgrade/stat, game/upgrade/item, game/vault/stake, game/cosmetics/buy,
game/deposit, game/withdrawal
wallet/balance, wallet/build-tx, wallet/treasury-balance
solana/rpc
transactions
health
```

Every route file follows the same 5-step shape and contains **no game logic**:

```ts
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);   // 1. Bearer JWT → { wallet }
  if (auth instanceof Response) return auth;         //    early-return 401
  try {
    const result = await claimVault(auth.wallet);    // 2. delegate to lib/game/*.server
    return jsonResponse(result, request,             // 3. CORS-aware JSON envelope
      { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[game/claim]", err);              // 4. tagged log
    return jsonResponse({ ok: false, error: "Internal server error" },
      request, { status: 500 });
  }
}
export async function OPTIONS(request: Request) { /* 5. preflight */ }
```

Conventions:

- Response envelope is always `{ ok: boolean, ... }` / `{ ok: false, error }`.
- Zod parses request bodies inside the route; `ZodError` → 400 with `issues`.
- Mongoose `Date` fields pass through `toEpoch()` from `lib/api/dto.ts` before
  leaving the handler, because DTO types declare epoch-ms numbers.
- Larger routes (e.g. `player/me`) split into private `handleGet`/`handlePost`
  helpers plus a `toPlayerDto()` mapper; the exported `GET`/`POST` stay thin.

---

## 5. Server game services — `lib/game/*.server.ts`

One file per player-facing operation: `claim`, `chest`, `raid`, `burn`,
`vault`, `upgrade`, `market`, `mining`, `cosmetic-shop`, plus `rng.ts`
(seeded/non-seeded randomness helper, the only non-`.server` file).

Each exports one async function that owns a whole transaction of game state:

```ts
export async function claimVault(wallet: string):
  Promise<{ ok: boolean; claimed?: number; error?: string }>
```

Rules observable in the code:

- Returns a **result object**, never throws for business failures.
- Reads through repositories only; never touches Mongoose models directly.
- Recomputes derived state before acting (`tickPlayer(player)` then persist
  `tickPatch(player)`) so no endpoint pays out stale values.
- Emits an audit log (`createLog({ type: "claim", wallet, amount, data })`) and
  bumps global counters (`void incrementStat("totalHashClaimed", claimable)`)
  as fire-and-forget side effects.
- Pure math is imported from `features/game/*` — the same functions the client
  uses — so client prediction and server truth can never disagree.

This shared-pure-core / duplicated-nothing arrangement is the single most
important idea to carry over.

---

## 6. `features/` — the domain layer

### `features/constants/game.ts`
Every tunable in one file: stat keys + metadata, slot keys + metadata, rarity
tables (`RARITY_META`, `RARITY_STAT_COUNT`, `RARITY_INDEX`), chest catalog and
prices, chest probability ladders (`CHEST_LADDERS`) plus derived percentage odds
(`CHEST_ODDS`), economy constants (softcaps, decay curves, charge regen, market
fee in bps, cooldowns). UI labels, icon names and Tailwind class names live
alongside the numbers.

### `features/game/*.ts` — pure functions, no I/O
`stats.ts`, `mining.ts`, `raid.ts`, `chest.ts`, `charges.ts`, `equipment.ts`,
`items.ts`, `item-names.ts`, `item-mapper.ts`, `level.ts`, `random.ts`.

They export cost curves (`upgradeCost = level²`, `totalUpgradeCost`,
`maxAffordableUpgrades`), stat composition (`emptyStatBlock`, `sumStatRolls`,
`totalStats`, `derivedBaseStats`), and threshold-table lookups
(`LUCK_TABLE`/`FIREWALL_TABLE`/`EXPLOIT_TABLE` + `pctFromTable`). Comments
explicitly state that each formula must mirror its `.server.ts` counterpart.

### `features/stores/*.ts` — Zustand
`playerStore`, `equipmentStore`, `chestStore`, `raidStore`, `marketplaceStore`,
`authStore`, `notificationStore`, `readNotificationsStore`, `legacyStorage`
(imported for its side effect of migrating old localStorage keys).

Stores are typed as `interface XState` + `interface XActions`, use `persist`,
call `lib/api/client` for the network, fall back to purely local simulation in
demo mode, and surface user feedback through `lib/notify`.

### `features/pages/*.tsx`
One component per route: `DashboardPage`, `InventoryPage`, `ChestsPage`,
`ShopPage`, `ProfilePage`, `MarketplacePage`, `WikiPage`, `LandingPage`.
`app/**/page.tsx` is a two-line file that re-exports the matching
`features/pages` component, so screens are framework-agnostic and routing stays
trivial.

### `features/templates/*.ts`
Static catalogs of purchasable/cosmetic content — `avatars`, `banners`,
`backgrounds`, `equipments` — keyed by numeric template ID that the DB stores.

### `features/types/game.ts`
The shared vocabulary: `StatKey`, `StatBlock`, `StatRoll`, `SlotKey`, `Rarity`,
`ChestKey`, `Equipment`. Imported by client code **and** by
`lib/modules/*/types.server.ts`, i.e. the DB schema types depend on the domain
types, never the reverse.

---

## 7. Client transport — `lib/api/`

| File | Role |
| --- | --- |
| `client.ts` | `"use client"` fetch wrapper: module-level token, `setAuthToken`, `ApiError(message, status)`, demo-mode short circuit (`cryptocore.demo` in localStorage), one exported function per endpoint |
| `types.ts` | DTOs the client consumes (`PlayerDto`, `ItemDto`, `MarketListingDto`, `ClaimResult`, `ChestResult`, `RaidResult`, `TickResult`, `UpgradeResult`, `PendingTxDto`, `SettledTxDto`, `LogDto`) |
| `dto.ts` | server-side mapping helpers (`toEpoch`) |
| `auth.ts` | `authenticateRequest(request) → AuthContext | Response` |
| `cors.ts` | `jsonResponse(body, request, init)` with CORS headers |

`AuthContext` is `{ wallet, username? }` — the wallet address is the identity
and primary key everywhere; there is no numeric user ID.

---

## 8. Hooks layer

`useGameStats` composes stores + pure math into one read-only `GameSnapshot`
(base/levels/total stats, vault capacity & fill, per-second rate, decay,
charge snapshots) — components never recompute domain values themselves.
`useMiningTick` drives the animation loop, `useNow` supplies a ticking clock,
`useEquipActions` wraps equip/unequip mutations, `useHydrated` guards
localStorage reads against SSR mismatch, `useServerLogs` polls the log feed,
`use-mobile` is the shadcn breakpoint helper.

---

## 9. Background worker — `server/game-smart-contract/`

A separate process (`pnpm server:smart-contract` → `tsx server/game-smart-contract/index.ts`),
documented as **run exactly one instance** so settlement stays sequential and
oldest-first.

- `index.ts` — loads dotenv, `connectDatabase()`, logs queue depth, constructs
  `TransactionWorker(sendOnChain)`, wires `SIGTERM`/`SIGINT` to a graceful stop.
- `workers/transaction-worker.ts` — drains `transactions-pending` oldest-first
  and settles three job types: `deposit`, `withdrawal`, `market_purchase`. It
  distinguishes a `NON_RETRYABLE` code set (`INSUFFICIENT_HASH`,
  `VERIFICATION_FAILED`, `NOT_FOUND`, `INVALID_AMOUNT`, `INVALID_WALLET`,
  `LISTING_GONE`) — dead-lettered immediately — from transient RPC/network
  failures, retried up to `config.withdrawal.maxRetries`.
- `lib/transfers.ts` — on-chain send; `lib/logger.ts` — structured logger.

The queue pair `transactions-pending` → `transactions-processed` is the
durability boundary: an API route only enqueues, the worker settles and records.

---

## 10. Configuration

`lib/config/config.ts` is declared as the **only** file that reads
`process.env`; everything else imports the frozen `config` object. It carries
`mongoUri`, `mongoDb`, `jwtSecret`, `withdrawal.{workerPollMs,maxRetries}` and a
`blockchain` block (`chain: "solana"`, treasury address/key, contract address,
`solana.{rpcUrl,heliusApiKey,mint}`). Public on-chain values may fall back to
`NEXT_PUBLIC_*`; secrets (`TREASURY_KEY`) never do.

`lib/config/database.ts` is a mongoose singleton cached on `global` to survive
dev hot-reloads, with `bufferCommands: false`.

---

## 11. Dependency direction (as enforced by the reference)

```text
app/(routes)  ──►  features/pages  ──►  components/*  ──►  components/ui
      │                  │
      │                  ├──►  features/stores  ──►  lib/api/client
      │                  └──►  hooks/*  ──►  features/game (pure)  ◄── shared
      │
app/api/*  ──►  lib/api/{auth,cors,dto}
           └──►  lib/game/*.server  ──►  lib/modules/<collection>/repository.server
                                              └──►  model.server ──► types.server
                                     └──►  features/game (pure) + features/constants
server/game-smart-contract  ──►  lib/modules/*, lib/chain/*, lib/config/*
```

Rules that fall out of this:

1. Components never import repositories, models, or `lib/game/*.server`.
2. Routes never contain game rules; services never contain HTTP concerns;
   repositories never contain game rules.
3. `lib/modules/*` may import `features/types` and `features/constants`, but not
   stores, hooks, or components.
4. Pure math lives once, in `features/game`, and is consumed by both sides.
5. `.server.ts` naming is the client-bundle firewall; the worker directory is
   never imported by the app.

---

## 12. Naming conventions summary

| Thing | Convention |
| --- | --- |
| DB module folder | `lib/modules/<plural-collection-name>/` (kebab-case) |
| DB files | `types.server.ts`, `model.server.ts`, `repository.server.ts` |
| Server service | `lib/game/<operation>.server.ts`, one exported async function |
| Pure domain | `features/game/<concept>.ts`, no I/O, no React |
| Constants | `features/constants/<area>.ts`, SCREAMING_SNAKE exports |
| Store | `features/stores/<name>Store.ts`, `useXStore` |
| Screen | `features/pages/<Name>Page.tsx`, re-exported by `app/**/page.tsx` |
| Component | `components/<area>/<PascalCase>.tsx` |
| Hook | `hooks/use<Name>.ts` |
| Interfaces | DB entities `I<Name>`, wire shapes `<Name>Dto` |
| Result shape | `{ ok: true, ... } | { ok: false, error }` |

---

## 13. Takeaways for the next HiveMint restructure

Directly portable:

- `lib/modules/<collection>/` with the fixed `types/model/repository` `.server.ts` triad.
- `lib/<domain>/<operation>.server.ts` service files returning `{ ok, ... }`.
- Pure domain math in `features/<domain>/` shared by client and server.
- All tunables in `features/constants/`.
- `features/pages/` screens with route files as thin re-exports.
- Thin route handlers: authenticate → validate → delegate → envelope → log.
- Atomic guarded `$inc` writes and scoped `$set` patches for all balances.
- Pending/processed queue pair for anything that must survive a crash.

Needs translating for HiveMint (TanStack Start, not Next):

- `app/api/**/route.ts` → `createServerFn` in `src/lib/**.functions.ts`, with
  `src/routes/api/public/*` reserved for external callers.
- `app/**/page.tsx` re-exports → `src/routes/*.tsx` route files whose
  `component` renders the `features/pages` screen (and which own `head()` SEO).
- `lib/api/client.ts` → `useServerFn` + TanStack Query; the manual token
  plumbing largely disappears.
- Mongoose models → whatever persistence HiveMint settles on; keep the
  repository function boundary so the driver stays swappable.
- Standalone `tsx` worker → not runnable on the edge target; needs a scheduled
  public API route or an external scheduler.

Anti-patterns to avoid copying:

- The missing `lib/modules/logs` module (imports that reference a non-existent folder).
- Duplicated formulas kept in sync only by comments — extract to one shared
  module and cover it with tests instead.
- `app/(game)/layout.tsx` existing purely as a pass-through.
- Very large single files (`features/constants/game.ts`, `player/me/route.ts`) that
  mix many concerns.

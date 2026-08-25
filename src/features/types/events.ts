/**
 * Application event / action contract.
 *
 * This is the seam between the transaction processor and everything that reacts
 * to it. It is deliberately free of React, Zustand, DOM and database imports so
 * that the API, the smart-contract worker and the frontend integration layer can
 * all depend on the same typed contract.
 */

export const APP_EVENTS = {
  NFT_MINTED: "NFT_MINTED",
  NFT_TRANSFERRED: "NFT_TRANSFERRED",
  NFT_LISTED: "NFT_LISTED",
  NFT_SOLD: "NFT_SOLD",
  LISTING_CANCELLED: "LISTING_CANCELLED",
  COLLECTION_CREATED: "COLLECTION_CREATED",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
} as const;

export type AppEventType = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

export interface AppEventPayloads {
  NFT_MINTED: {
    transactionId: string;
    hiveTransactionId: string;
    nftId: string;
    collectionId: string;
    owner: string;
    tokenId: number;
  };
  NFT_TRANSFERRED: {
    transactionId: string;
    hiveTransactionId: string;
    nftId: string;
    collectionId: string;
    from: string;
    to: string;
  };
  NFT_LISTED: {
    transactionId: string;
    hiveTransactionId: string;
    listingId: string;
    nftId: string;
    collectionId: string;
    seller: string;
    price: number;
  };
  NFT_SOLD: {
    transactionId: string;
    hiveTransactionId: string;
    listingId: string;
    nftId: string;
    collectionId: string;
    seller: string;
    buyer: string;
    price: number;
    marketplaceFee: number;
  };
  LISTING_CANCELLED: {
    transactionId: string;
    hiveTransactionId: string;
    listingId: string;
    nftId: string;
    seller: string;
  };
  COLLECTION_CREATED: {
    transactionId: string;
    hiveTransactionId: string;
    collectionId: string;
    creator: string;
    symbol: string;
    maxSupply: number;
  };
  PAYMENT_CONFIRMED: {
    transactionId: string;
    hiveTransactionId: string;
    from: string;
    to: string;
    amount: number;
    currency: "HIVE";
    memo: string;
  };
  TRANSACTION_FAILED: {
    transactionId: string;
    type: string;
    hiveAccount: string;
    error: string;
  };
}

export interface AppEvent<T extends AppEventType = AppEventType> {
  type: T;
  payload: AppEventPayloads[T];
  occurredAt: string;
}

/** Typed action creator. */
export function createAction<T extends AppEventType>(
  type: T,
  payload: AppEventPayloads[T],
): AppEvent<T> {
  return { type, payload, occurredAt: new Date().toISOString() };
}

type Handler = (event: AppEvent) => void | Promise<void>;

/**
 * Minimal in-process event bus. Phase 3 can replace the transport (queue,
 * websocket fan-out) without touching the event contract above.
 */
export class EventBus {
  private handlers = new Map<AppEventType | "*", Set<Handler>>();
  private log: AppEvent[] = [];

  on<T extends AppEventType>(type: T | "*", handler: (event: AppEvent<T>) => void | Promise<void>) {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(handler as Handler);
    this.handlers.set(type, set);
    return () => set.delete(handler as Handler);
  }

  async emit<T extends AppEventType>(event: AppEvent<T>): Promise<AppEvent<T>> {
    this.log.unshift(event as AppEvent);
    this.log = this.log.slice(0, 200);
    const targets = [...(this.handlers.get(event.type) ?? []), ...(this.handlers.get("*") ?? [])];
    for (const handler of targets) {
      await handler(event as AppEvent);
    }
    return event;
  }

  /** Recent events — useful for debugging and for future SSE/websocket fan-out. */
  recent(limit = 50) {
    return this.log.slice(0, limit);
  }
}

interface BusGlobal {
  __hivemint_bus?: EventBus | undefined;
}
const busGlobal = globalThis as unknown as BusGlobal;

export function getEventBus(): EventBus {
  if (!busGlobal.__hivemint_bus) busGlobal.__hivemint_bus = new EventBus();
  return busGlobal.__hivemint_bus;
}

export const emitAppEvent = <T extends AppEventType>(type: T, payload: AppEventPayloads[T]) =>
  getEventBus().emit(createAction(type, payload));

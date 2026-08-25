import "@/features/stores/legacyStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Read-state for notifications lives purely on the client — server logs are an
 * immutable audit trail, so players can mark entries read but never delete them.
 */
interface ReadNotificationsState {
  readIds: string[];
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
}

const MAX_TRACKED = 500;

export const useReadNotificationsStore = create<ReadNotificationsState>()(
  persist(
    (set, get) => ({
      readIds: [],
      isRead: (id) => get().readIds.includes(id),
      markRead: (id) =>
        set((state) =>
          state.readIds.includes(id)
            ? state
            : { readIds: [id, ...state.readIds].slice(0, MAX_TRACKED) },
        ),
      markAllRead: (ids) =>
        set((state) => ({
          readIds: Array.from(new Set([...ids, ...state.readIds])).slice(0, MAX_TRACKED),
        })),
    }),
    { name: "cryptocore.notifications.read", version: 1 },
  ),
);

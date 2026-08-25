import { toast } from "sonner";

import { useNotificationStore } from "@/features/stores/notificationStore";
import type { ActivityEntry } from "@/features/types/game";

/**
 * Single entry point for player-facing feedback: writes to the activity feed
 * and raises a toast.
 */
export const notify = (
  message: string,
  kind: ActivityEntry["kind"] = "info",
  parts?: ActivityEntry["parts"],
): void => {
  useNotificationStore.getState().push(message, kind, parts);
  if (kind === "success" || kind === "loot") toast.success(message);
  else if (kind === "danger") toast.error(message);
  else toast(message);
};

import { activityRepository } from "@/lib/modules/activity/repository.server";
import { json } from "../lib/respond";
import { parseIntParam } from "../lib/request";
import type { Router } from "../lib/router";

export function registerActivityRoutes(router: Router) {
  router.get("/activity", async ({ query }) => {
    const actor = query.get("actor");
    const list = actor
      ? await activityRepository.listByActor(actor, parseIntParam(query.get("limit"), 100))
      : await activityRepository.listRecent(parseIntParam(query.get("limit"), 100));
    return json({ activity: list });
  });
}

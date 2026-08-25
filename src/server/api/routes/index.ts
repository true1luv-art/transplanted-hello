import { createRouter } from "../lib/router";
import { registerHealthRoutes } from "./health.routes";
import { registerCollectionsRoutes } from "./collections.routes";
import { registerNftsRoutes } from "./nfts.routes";
import { registerListingsRoutes } from "./listings.routes";
import { registerActivityRoutes } from "./activity.routes";
import { registerUsersRoutes } from "./users.routes";
import { registerTransactionsRoutes } from "./transactions.routes";
import { registerAdminRoutes } from "./admin.routes";

export function createApiRouter() {
  const router = createRouter();
  registerHealthRoutes(router);
  registerCollectionsRoutes(router);
  registerNftsRoutes(router);
  registerListingsRoutes(router);
  registerActivityRoutes(router);
  registerUsersRoutes(router);
  registerTransactionsRoutes(router);
  registerAdminRoutes(router);
  return router;
}

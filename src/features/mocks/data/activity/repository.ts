import { appData } from "@/features/lib/data/app-data";
import { buildActivity, buildTransaction } from "@/features/mocks/data/activity/model";
import type { Activity, NewActivity, NewTransaction, Transaction } from "@/features/types/domain/activity";

export const activityRepository = {
  list(): Activity[] {
    return appData.read().activities;
  },

  listByCollection(collectionId: string): Activity[] {
    return appData.read().activities.filter((a) => a.collectionId === collectionId);
  },

  add(input: NewActivity): Activity {
    const activity = buildActivity(input);
    appData.update((s) => ({ activities: [activity, ...s.activities] }));
    return activity;
  },

  transactions(): Transaction[] {
    return appData.read().transactions;
  },

  addTransaction(input: NewTransaction): Transaction {
    const tx = buildTransaction(input);
    appData.update((s) => ({ transactions: [tx, ...s.transactions] }));
    return tx;
  },
};

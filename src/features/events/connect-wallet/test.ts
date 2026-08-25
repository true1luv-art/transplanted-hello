import { beforeEach, describe, expect, it } from "vitest";

import { appData, createDemoData } from "@/features/lib/data/app-data";
import { connectWallet, disconnectWallet } from "./action";

describe("connectWallet", () => {
  beforeEach(() => appData.patch(createDemoData()));

  it("starts a session for the connected account", async () => {
    appData.patch({ user: null, walletConnected: false });
    const { user } = await connectWallet({ username: "alice" });

    expect(user.username).toBe("alice");
    expect(appData.read().walletConnected).toBe(true);
    expect(appData.read().connecting).toBe(false);
  });

  it("clears the session on disconnect", async () => {
    await disconnectWallet();
    expect(appData.read().user).toBeNull();
    expect(appData.read().walletConnected).toBe(false);
  });
});

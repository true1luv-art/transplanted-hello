import { describe, expect, it } from "vitest";
import { createUserDocument, toUserView } from "@/lib/modules/users/model.server";
import type { ActivityDocument } from "@/lib/modules/activity/types.server";
import type { HiveAccount } from "./types";
import {
  hiveAvatarUrl,
  normalizeHiveUsername,
  parseAccountProfile,
  parseAssetAmount,
  readAccountHiveBalance,
} from "./hive";

function fakeAccount(name: string, profile: Record<string, unknown>, balance = "12.500 HIVE") {
  return {
    name,
    balance,
    posting_json_metadata: JSON.stringify({ profile }),
    json_metadata: "",
  } as unknown as HiveAccount;
}

describe("hive avatar derivation", () => {
  it("derives the avatar URL for a Hive account", () => {
    expect(hiveAvatarUrl("rhiaji")).toBe("https://images.hive.blog/u/rhiaji/avatar");
  });

  it("is dynamic for any username", () => {
    for (const username of ["alice", "bob", "some-hive-user"]) {
      expect(hiveAvatarUrl(username)).toBe(`https://images.hive.blog/u/${username}/avatar`);
    }
  });

  it("normalizes @ prefixes and casing", () => {
    expect(normalizeHiveUsername("@Rhiaji")).toBe("rhiaji");
    expect(hiveAvatarUrl("@Rhiaji")).toBe("https://images.hive.blog/u/rhiaji/avatar");
  });
});

describe("hive account profile metadata", () => {
  it("normalizes profile metadata from posting_json_metadata", () => {
    const profile = parseAccountProfile(
      fakeAccount("rhiaji", {
        name: "Rhiaji",
        about: "Hive builder",
        profile_image: "https://images.hive.blog/u/rhiaji/avatar",
        cover_image: "https://example.com/banner.png",
        location: "PH",
        website: "https://example.com",
      }),
    );
    expect(profile.username).toBe("rhiaji");
    expect(profile.displayName).toBe("Rhiaji");
    expect(profile.coverImage).toBe("https://example.com/banner.png");
    expect(profile.avatarUrl).toBe("https://images.hive.blog/u/rhiaji/avatar");
  });

  it("falls back to a derived avatar when metadata is empty", () => {
    const profile = parseAccountProfile(fakeAccount("someone", {}));
    expect(profile.avatarUrl).toBe("https://images.hive.blog/u/someone/avatar");
    expect(profile.coverImage).toBeUndefined();
  });
});

describe("hive balance is indexed chain state", () => {
  it("parses asset strings", () => {
    expect(parseAssetAmount("12.500 HIVE")).toBeCloseTo(12.5, 3);
    expect(parseAssetAmount({ amount: "12500", precision: 3 })).toBeCloseTo(12.5, 3);
  });

  it("reads the balance from the chain account", () => {
    expect(readAccountHiveBalance(fakeAccount("rhiaji", {}, "3.250 HIVE"))).toBeCloseTo(3.25, 3);
  });

  it("never stores the chain balance on the user document", () => {
    const user = createUserDocument({ username: "rhiaji" });
    expect(Object.keys(user)).not.toContain("hiveBalance");
    expect(user.ledgerBalance).toBe(0);
  });
});

describe("user identity is the Hive account", () => {
  it("uses the Hive username as the only identity field", () => {
    const user = createUserDocument({ username: "@Rhiaji" });
    expect(user.username).toBe("rhiaji");
    expect(Object.keys(user)).not.toContain("walletAddress");
    expect(Object.keys(user)).not.toContain("avatarSeed");
  });

  it("derives the avatar in the read model instead of storing it", () => {
    const view = toUserView(createUserDocument({ username: "alice" }));
    expect(view.avatarUrl).toBe("https://images.hive.blog/u/alice/avatar");
  });

  it("derives images from the Hive CDN instead of storing profile metadata", () => {
    const view = toUserView(createUserDocument({ username: "bob" }));
    expect(view.avatarUrl).toBe("https://images.hive.blog/u/bob/avatar");
    expect(view.bannerUrl).toBe("https://images.hive.blog/u/bob/cover");
    expect(Object.keys(view)).not.toContain("profile");
  });
});

describe("activity actors are Hive accounts", () => {
  it("accepts Hive usernames as actor and target", () => {
    const activity: ActivityDocument = {
      id: "act_1",
      type: "Sold",
      actor: "rhiaji",
      target: "anotherhiveuser",
      label: "Sold NFT",
      createdAt: new Date().toISOString(),
    };
    expect(activity.actor).toBe("rhiaji");
    expect(activity.target).toBe("anotherhiveuser");
    expect(Object.keys(activity)).not.toContain("actorWallet");
  });
});

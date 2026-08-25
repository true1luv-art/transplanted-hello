import { connectDatabase, toUpdate } from "@/lib/config/database";
import { nowIso } from "@/lib/config/helpers";
import { UserModel, createUserDocument, toUserView } from "./model.server";
import type { CreateUserInput, UserDocument, UserView } from "./types.server";

/**
 * Persistence for the `users` collection.
 *
 * App-owned state only: role and the simulated settlement ledger. Display
 * name, profile metadata and the real HIVE balance are never stored here —
 * they are read from Hive (`src/lib/chain/`) at request time.
 *
 * Queries talk to the Mongoose model directly — no generic base class.
 *
 * SERVER-ONLY.
 */

const normalize = (username: string) => username.trim().replace(/^@/, "").toLowerCase();

class UsersRepository {
  async findById(id: string): Promise<UserDocument | null> {
    await connectDatabase();
    return UserModel.findOne({ id }).lean<UserDocument | null>().exec();
  }

  /** Lookup by Hive account name (the canonical identity). */
  async findByUsername(username: string): Promise<UserDocument | null> {
    await connectDatabase();
    return UserModel.findOne({ username: normalize(username) })
      .lean<UserDocument | null>()
      .exec();
  }

  async viewByUsername(username: string): Promise<UserView | null> {
    const user = await this.findByUsername(username);
    return user ? toUserView(user) : null;
  }

  async insert(doc: UserDocument): Promise<UserDocument> {
    await connectDatabase();
    await UserModel.create(doc);
    return doc;
  }

  async ensure(input: CreateUserInput): Promise<UserDocument> {
    const existing = await this.findByUsername(input.username);
    if (existing) return existing;
    return this.insert(createUserDocument(input));
  }

  async ensureViews(inputs: ReadonlyArray<CreateUserInput>): Promise<UserView[]> {
    const docs: UserDocument[] = [];
    for (const input of inputs) docs.push(await this.ensure(input));
    return docs.map(toUserView);
  }

  async setLedgerBalance(username: string, ledgerBalance: number): Promise<UserDocument | null> {
    return this.patchByUsername(username, {
      ledgerBalance: Number(ledgerBalance.toFixed(3)),
    });
  }

  /** Adjusts the simulated ledger used by locally settled (mock) operations. */
  async adjustBalance(username: string, delta: number): Promise<UserDocument | null> {
    const user = await this.findByUsername(username);
    if (!user) return null;
    return this.patchByUsername(user.username, {
      ledgerBalance: Number((user.ledgerBalance + delta).toFixed(3)),
    });
  }

  async listAll(): Promise<UserDocument[]> {
    await connectDatabase();
    return UserModel.find().sort({ username: 1 }).lean<UserDocument[]>().exec();
  }

  async count(): Promise<number> {
    await connectDatabase();
    return UserModel.countDocuments().exec();
  }

  async clear(): Promise<void> {
    await connectDatabase();
    await UserModel.deleteMany({}).exec();
  }

  private async patchByUsername(
    username: string,
    patch: Partial<UserDocument>,
  ): Promise<UserDocument | null> {
    await connectDatabase();
    return UserModel.findOneAndUpdate(
      { username: normalize(username) },
      toUpdate({ ...patch, updatedAt: nowIso() }),
      { new: true },
    )
      .lean<UserDocument | null>()
      .exec();
  }
}

export const usersRepository = new UsersRepository();

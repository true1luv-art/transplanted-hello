import { TemplateModel } from "./model.server";
import type { ITemplate, ITemplateData, TemplateKind } from "./types.server";
import { connectDatabase } from "@/lib/config/database";

export async function findTemplateById(id: number): Promise<ITemplate | null> {
  await connectDatabase();
  return TemplateModel.findById(id).lean<ITemplate>();
}

export async function findTemplatesByKind(kind: TemplateKind): Promise<ITemplate[]> {
  await connectDatabase();
  return TemplateModel.find({ kind }).lean<ITemplate[]>();
}

export async function findAllTemplates(): Promise<ITemplate[]> {
  await connectDatabase();
  return TemplateModel.find({}).sort({ _id: 1 }).lean<ITemplate[]>();
}

export async function findItemTemplateBySlotRarity(
  slot: string,
  rarity: string,
): Promise<ITemplate | null> {
  await connectDatabase();
  return TemplateModel.findOne({ kind: "item", slot, rarity }).lean<ITemplate>();
}

/**
 * Atomically increments mintCount for a template.
 *
 * For cosmetics with a maxSupply: rejects if already at cap.
 * For items (maxSupply: null) and soulbound cosmetics: no cap — always succeeds.
 *
 * Returns the new mintCount which equals this mint's edition number.
 */
export async function incrementMintCount(
  id: number,
): Promise<{ ok: boolean; mintNumber: number; error?: string }> {
  await connectDatabase();

  const template = await TemplateModel.findById(id).lean<ITemplate>();
  if (!template) return { ok: false, mintNumber: 0, error: `Template ${id} not found` };

  // Enforce supply cap for capped cosmetics
  if (template.maxSupply !== null && template.mintCount >= template.maxSupply) {
    return {
      ok: false,
      mintNumber: template.mintCount,
      error: `Template ${id} is sold out (${template.mintCount}/${template.maxSupply})`,
    };
  }

  const updated = await TemplateModel.findByIdAndUpdate(
    id,
    { $inc: { mintCount: 1 } },
    { new: true },
  ).lean<ITemplate>();

  if (!updated) return { ok: false, mintNumber: 0, error: "Template update failed" };
  return { ok: true, mintNumber: updated.mintCount };
}

/**
 * Upserts a template document. Used by the seed script.
 */
export async function upsertTemplate(data: ITemplateData): Promise<void> {
  await connectDatabase();
  await TemplateModel.findByIdAndUpdate(data._id, { $set: data }, { upsert: true, new: true });
}

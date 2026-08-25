import { IDLE_PROGRESS, type GeneratorContext } from "@/features/types/generation";
import {
  buildBatchArchive,
  buildBundleArchive,
  buildCollectionArchive,
} from "@/features/lib/generator/export";
import type { ExportFile } from "@/features/lib/generator/types";
import { splitBatches } from "@/features/lib/generator/batching";

/** Lets the browser paint between heavy synchronous zip steps. */
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Builds the downloadable image/metadata archives for the current result. */
export async function exportNfts(ctx: GeneratorContext): Promise<void> {
  const { result, settings, layers } = ctx.get();
  if (!result) return;

  const batchPlan = splitBatches(result.nfts, settings);
  // steps: collection archive + every batch + final bundle
  const total = batchPlan.length + 2;
  const report = (done: number, label: string) =>
    ctx.set({ progress: { phase: "packaging", done, total, label } });

  report(0, "Preparing archives");
  ctx.set({ error: null });
  await yieldToBrowser();

  try {
    const collection = buildCollectionArchive(settings, layers);
    report(1, `Packaging batch 1 of ${batchPlan.length}`);
    await yieldToBrowser();

    const batches: ExportFile[] = [];
    for (const [index, batch] of batchPlan.entries()) {
      batches.push(buildBatchArchive(batch, result.nfts, ctx.artwork.images));
      const next = index + 2;
      report(
        next,
        index + 1 < batchPlan.length
          ? `Packaging batch ${index + 2} of ${batchPlan.length}`
          : "Building the final archive",
      );
      await yieldToBrowser();
    }

    const bundle = buildBundleArchive(settings, [collection, ...batches], result.nfts.length);

    ctx.set({
      exportPackage: { collection, batches, bundle, batchPlan },
      progress: {
        phase: "ready",
        done: total,
        total,
        label: "Archives ready",
      },
    });
  } catch (error) {
    ctx.set({
      error: error instanceof Error ? error.message : "Export failed",
      progress: IDLE_PROGRESS,
    });
  }
}

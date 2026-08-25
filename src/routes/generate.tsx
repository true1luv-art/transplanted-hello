import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Loader2, RotateCcw, Sparkles, Wand2 } from "lucide-react";

import { CollectionPreviewGrid } from "@/components/generator/CollectionPreviewGrid";
import { CollectionSettings } from "@/components/generator/CollectionSettings";
import { ExportPanel } from "@/components/generator/ExportPanel";
import { ItemDetails } from "@/components/generator/ItemDetails";
import { LayersSidebar } from "@/components/generator/LayersSidebar";
import { PropertyFilter } from "@/components/generator/PropertyFilter";
import { StudioStepper } from "@/components/generator/StudioStepper";
import { TraitManager } from "@/components/generator/TraitManager";
import { TraitPicker } from "@/components/generator/TraitPicker";
import { ValidationPanel } from "@/components/generator/ValidationPanel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { splitBatches } from "@/features/lib/generator/batching";
import { maxCombinations } from "@/features/lib/generator/engine";
import {
  hasBlockingErrors,
  validateGeneration,
  validateProject,
} from "@/features/lib/generator/validate";
import { useGeneratorStore } from "@/features/stores/generator-store";

const title = "NFT Generation Studio — HiveX NFTs";
const description =
  "Stack weighted trait layers, generate unique NFT artwork and metadata in your browser, edit any item, then export import-ready ZIP batches.";

export const Route = createFileRoute("/generate")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GenerateStudio,
});

function GenerateStudio() {
  const {
    settings,
    layers,
    activeLayerId,
    step,
    result,
    exportPackage,
    progress,
    error,
    selectedTokenId,
    editLayerId,
    filters,
  } = useGeneratorStore();
  const {
    setStep,
    setActiveLayer,
    updateSettings,
    addLayer,
    renameLayer,
    removeLayer,
    toggleLayer,
    moveLayer,
    addTraits,
    updateTrait,
    removeTrait,
    generate,
    buildExport,
    loadSample,
    reset,
    selectNft,
    setEditLayer,
    renameNft,
    replaceNftTrait,
    toggleFilter,
    clearFilters,
  } = useGeneratorStore();
  const projectIssues = useMemo(() => validateProject({ settings, layers }), [settings, layers]);
  const exportIssues = useMemo(() => validateGeneration(result, { settings }), [result, settings]);
  const combinations = useMemo(() => maxCombinations(layers), [layers]);
  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? null,
    [layers, activeLayerId],
  );
  const plannedBatches = useMemo(
    () => (result ? splitBatches(result.nfts, settings) : []),
    [result, settings],
  );

  const filteredNfts = useMemo(() => {
    if (!result) return [];
    const entries = Object.entries(filters).filter(([, ids]) => ids.length > 0);
    if (entries.length === 0) return result.nfts;
    return result.nfts.filter((nft) =>
      entries.every(([layerId, traitIds]) =>
        nft.traits.some((ref) => ref.layerId === layerId && traitIds.includes(ref.traitId)),
      ),
    );
  }, [result, filters]);

  const selectedNft = useMemo(
    () => result?.nfts.find((nft) => nft.tokenId === selectedTokenId) ?? null,
    [result, selectedTokenId],
  );

  const busy =
    progress.phase === "generating" ||
    progress.phase === "composing" ||
    progress.phase === "packaging";
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const blocked = hasBlockingErrors(projectIssues);

  useEffect(() => {
    if (step !== "export" || !result || exportPackage || busy) return;
    if (hasBlockingErrors(exportIssues)) return;
    void buildExport();
  }, [step, result, exportPackage, busy, exportIssues, buildExport]);

  return (
    <div>
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-tight">NFT Generation Studio</h1>
          <p className="pt-1 max-w-2xl text-sm text-muted-foreground">
            Build layers, generate unique artwork locally, edit individual items, then export
            archives ready for collection import.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadSample}>
            <Sparkles className="mr-2 size-4" /> Load sample
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 size-4" /> Reset
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <StudioStepper step={step} canPreview={Boolean(result)} onStep={setStep} />
        {step === "generate" && result && !busy && (
          <Button size="sm" onClick={() => setStep("preview")}>
            View collection <ArrowRight className="ml-2 size-4" />
          </Button>
        )}
        {step === "preview" && result && (
          <Button size="sm" onClick={() => setStep("export")}>
            Continue to export <ArrowRight className="ml-2 size-4" />
          </Button>
        )}
      </div>

      {(busy || error) && (
        <div className="pt-4">
          {busy && (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin text-primary" />
                {progress.label} — {progress.done}/{progress.total}
              </div>
              <Progress value={percent} />
            </div>
          )}
          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      {step === "generate" && (
        <div className="grid gap-6 pt-6 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
            <LayersSidebar
              layers={layers}
              activeLayerId={activeLayerId}
              onSelect={setActiveLayer}
              onAdd={addLayer}
              onRename={renameLayer}
              onRemove={removeLayer}
              onToggle={toggleLayer}
              onMove={moveLayer}
            />
          </aside>

          <section className="min-w-0">
            <TraitManager
              layer={activeLayer}
              onAddTraits={addTraits}
              onUpdateTrait={updateTrait}
              onRemoveTrait={removeTrait}
            />
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <CollectionSettings
              settings={settings}
              combinations={combinations}
              onChange={updateSettings}
            />
            <ValidationPanel issues={projectIssues} />
            <Button className="w-full" disabled={busy || blocked} onClick={() => void generate()}>
              <Wand2 className="mr-2 size-4" /> Generate {settings.supply} items
            </Button>
            {result && !busy && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
                <p>
                  Generated <span className="font-semibold">{result.generated}</span> items ·{" "}
                  {result.unique} unique combinations.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}

      {step === "preview" && result && (
        <div className="grid gap-6 pt-6 lg:grid-cols-[240px_minmax(0,1fr)_340px] lg:h-[calc(100vh-12rem)]">
          <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <PropertyFilter
              layers={layers}
              distribution={result.distribution}
              filters={filters}
              onToggle={toggleFilter}
              onClear={clearFilters}
            />
          </aside>

          <section className="min-w-0 overflow-hidden">
            <CollectionPreviewGrid
              nfts={filteredNfts}
              total={result.nfts.length}
              selectedTokenId={selectedTokenId}
              onSelect={selectNft}
            />
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <ItemDetails
              nft={selectedNft}
              distribution={result.distribution}
              editLayerId={editLayerId}
              onRename={renameNft}
              onEditLayer={setEditLayer}
            />
            <Dialog open={!!editLayerId} onOpenChange={(open) => !open && setEditLayer(null)}>
              <DialogContent className="max-w-2xl">
                <div className="h-[70vh] max-h-[560px]">
                  <TraitPicker
                    nft={selectedNft}
                    layer={layers.find((layer) => layer.id === editLayerId) ?? null}
                    distribution={result.distribution}
                    onPick={(tokenId, layerId, traitId) => {
                      void replaceNftTrait(tokenId, layerId, traitId);
                      setEditLayer(null);
                    }}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </aside>
        </div>
      )}

      {step === "export" && result && (
        <div className="grid gap-6 pt-6">
          <section className="mx-auto w-full max-w-3xl space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
                Export summary
              </h2>
              <dl className="grid grid-cols-2 gap-3 pt-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Items</dt>
                  <dd className="font-semibold">{result.generated}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Unique</dt>
                  <dd className="font-semibold">{result.unique}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Trait types</dt>
                  <dd className="font-semibold">{result.traitTypes}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Batches</dt>
                  <dd className="font-semibold">{plannedBatches.length}</dd>
                </div>
              </dl>
            </div>

            <ValidationPanel issues={exportIssues} />

            {exportPackage ? (
              <ExportPanel
                collection={exportPackage.collection}
                batches={exportPackage.batches}
                bundle={exportPackage.bundle}
                onReset={reset}
              />
            ) : (
              <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  {busy ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
                  <span>
                    {busy
                      ? `${progress.label || "Packaging your collection"} — step ${progress.done}/${progress.total}`
                      : "Preparing your download…"}
                  </span>
                  {!busy && !hasBlockingErrors(exportIssues) ? (
                    <Button size="sm" className="ml-auto" onClick={() => void buildExport()}>
                      Retry
                    </Button>
                  ) : null}
                </div>
                {busy ? (
                  <>
                    <Progress value={percent} />
                    <p className="text-xs">
                      Large collections take a while to compress. Please keep this tab open — nothing
                      is uploaded, everything is built locally.
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

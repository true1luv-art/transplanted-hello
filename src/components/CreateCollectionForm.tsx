import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Rocket, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { AssetUploader, type PickedFile } from "@/components/AssetUploader";
import { ImportDropzone } from "@/components/import/ImportDropzone";
import { BatchImportPanel } from "@/components/import/BatchImportPanel";
import { ValidationReport } from "@/components/import/ValidationReport";
import { TraitAnalysis } from "@/components/import/TraitAnalysis";
import { ImportPreviewGrid } from "@/components/import/ImportPreviewGrid";
import { TransactionStatus, type TxState } from "@/components/TransactionStatus";
import { generateArtwork } from "@/lib/art";
import { hive, num } from "@/lib/format";
import { collectionCreationCost, config } from "@/lib/config/config";
import { importZipPackage, entryToFile, zipSourceFromFile } from "@/features/lib/import";
import type {
  BatchImportResult,
  CollectionMetadataImport,
  ImportProgress,
} from "@/features/lib/import/zip-batch";
import { mimeFromFilename } from "@/features/lib/storage/validation";
import type { ImportReport } from "@/features/lib/import/types";
import type { UploadState } from "@/features/lib/import/pipeline";
import { importCollection } from "@/features/events/import-collection/action";
import { useAppStore } from "@/features/stores/app-store";
import { cn } from "@/lib/utils";

const STEPS = ["Details", "Archives", "Review", "Submit"] as const;
type Step = 0 | 1 | 2 | 3;

const PREVIEW_SAMPLE = 24;

/**
 * Collection IMPORT wizard — ZIP based.
 *
 * The creator uploads one collection metadata archive (metadata/metadata.json)
 * and one or more NFT batch archives ({batch}/images + {batch}/metadata). The
 * platform extracts, matches, validates, indexes and scores them. Nothing is
 * generated here: the NFT records already exist inside the archives.
 */
export function CreateCollectionForm() {
  const navigate = useNavigate();
  const balance = useAppStore((s) => (s.user ? (s.balances[s.user.username] ?? 0) : 0));
  const creatorName = useAppStore((s) => s.user?.username ?? "guest");

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [mintPrice, setMintPrice] = useState("4.00");
  const [mintStartDate, setMintStartDate] = useState("");
  const [mintEndDate, setMintEndDate] = useState("");
  const [coverFile, setCoverFile] = useState<PickedFile | null>(null);

  const [collectionZip, setCollectionZip] = useState<File | null>(null);
  const [batchZips, setBatchZips] = useState<File[]>([]);
  const [collectionMeta, setCollectionMeta] = useState<CollectionMetadataImport | null>(null);
  const [batches, setBatches] = useState<BatchImportResult[]>([]);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [duplicateIds, setDuplicateIds] = useState(0);

  const [state, setState] = useState<TxState>("idle");
  const [upload, setUpload] = useState<UploadState | null>(null);
  const previewUrls = useRef<string[]>([]);
  /** Extracted NFT images by filename — pinned once the package is valid. */
  const imageFiles = useRef<Map<string, File>>(new Map());

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(
    () => () => {
      if (coverFile) URL.revokeObjectURL(coverFile.previewUrl);
    },
    [coverFile],
  );

  const supply = report?.statistics.totalNfts ?? 0;
  const creationCost = collectionCreationCost(supply);
  const fallbackImage = useMemo(() => generateArtwork(`preview-${symbol}-${name}`), [symbol, name]);

  const detailsValid =
    name.trim().length > 1 && symbol.trim().length > 1 && Number(mintPrice) > 0 && !!coverFile;

  const analyze = async () => {
    setAnalyzing(true);
    setProgress(null);
    try {
      const result = await importZipPackage({
        collectionZip: collectionZip ? await zipSourceFromFile(collectionZip) : undefined,
        batchZips: await Promise.all(batchZips.map(zipSourceFromFile)),
        onProgress: setProgress,
      });

      setCollectionMeta(result.collection);
      setBatches(result.batches);
      setDuplicateIds(
        result.crossBatchDuplicateTokenIds.length +
          result.batches.reduce((sum, batch) => sum + batch.duplicateTokenIds.length, 0),
      );

      // The generated project prefills name/description — the creator can still edit them.
      if (result.collection?.name && !name.trim()) setName(result.collection.name);
      if (result.collection?.description && !description.trim())
        setDescription(result.collection.description);

      // Keep the extracted image bytes for the (mock) IPFS pinning step.
      imageFiles.current = new Map(
        result.images.map((image) => [
          image.filename,
          entryToFile(image.entry, mimeFromFilename(image.filename)),
        ]),
      );

      // Previews only for the sample the review step actually renders.
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      const sample = [...result.report.nfts]
        .sort((a, b) => a.rarityRank - b.rarityRank)
        .slice(0, PREVIEW_SAMPLE);
      for (const nft of sample) {
        const file = nft.matchedFilename ? imageFiles.current.get(nft.matchedFilename) : undefined;
        if (!file) continue;
        const url = URL.createObjectURL(file);
        previewUrls.current.push(url);
        nft.previewUrl = url;
      }

      setReport({ ...result.report });
      setStep(2);
      if (!result.report.ready)
        toast.error("Import has errors", { description: "Fix the archives and import again." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import the archives");
    } finally {
      setAnalyzing(false);
    }
  };

  const deploy = async () => {
    if (!report?.ready || !coverFile) return;
    if (balance < creationCost) {
      toast.error("Insufficient HIVE balance", {
        description: `Importing ${num(supply)} NFTs costs ${hive(creationCost)}.`,
      });
      return;
    }
    setState("pending");
    try {
      const collection = await importCollection(
        {
          name,
          symbol,
          description,
          mintPrice: Number(mintPrice),
          mintStartDate: mintStartDate ? new Date(mintStartDate).toISOString() : null,
          mintEndDate: mintEndDate ? new Date(mintEndDate).toISOString() : null,
          collectionImage: coverFile.file,
          collectionImageUrl: coverFile.previewUrl,
          report,
          imageFiles: imageFiles.current,
          fallbackImage,
          balance,
        },
        { onUploadState: setUpload },
      );

      setState("success");
      toast.success("Collection imported", { description: `${num(supply)} NFTs indexed` });
      setTimeout(() => navigate({ to: "/collections/$id", params: { id: collection.id } }), 900);
    } catch (e) {
      setState("error");
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => index <= step && setStep(index as Step)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  index === step
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {index + 1}. {label}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="surface-card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Collection details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collection name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Symbol">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Mint price (HIVE)">
              <Input
                inputMode="decimal"
                value={mintPrice}
                onChange={(e) => setMintPrice(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mint start date">
                <Input
                  type="datetime-local"
                  value={mintStartDate}
                  onChange={(e) => setMintStartDate(e.target.value)}
                />
              </Field>
              <Field label="Mint end date">
                <Input
                  type="datetime-local"
                  value={mintEndDate}
                  onChange={(e) => setMintEndDate(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Mint price and dates are stored with the collection record and can be changed later
              without republishing any NFT metadata.
            </p>
            <AssetUploader
              label="Collection artwork"
              hint="Cover image for the collection — separate from the NFT images"
              accept={config.storage.supportedImageTypes.join(",")}
              files={coverFile ? [coverFile] : []}
              onPick={(files) => {
                const file = files[0];
                if (!file) return;
                setCoverFile({ file, previewUrl: URL.createObjectURL(file) });
              }}
              onRemove={() => setCoverFile(null)}
            />
            <Button className="w-full" disabled={!detailsValid} onClick={() => setStep(1)}>
              Continue to upload
            </Button>
          </section>
        )}

        {step === 1 && (
          <section className="surface-card space-y-5 p-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Upload your archives</h2>
              <p className="text-xs text-muted-foreground">
                Upload the ZIPs your export tool produced — no extracting, renaming or per-file
                uploads. Supply comes from the imported metadata; nothing is generated here.
              </p>
            </div>

            <ImportDropzone
              label="Collection metadata ZIP"
              hint="metadata.zip → metadata/metadata.json"
              accept=".zip,application/zip"
              files={collectionZip ? [collectionZip] : []}
              disabled={analyzing}
              onPick={(files) => {
                const zip = files.find((f) => /\.zip$/i.test(f.name));
                if (zip) setCollectionZip(zip);
              }}
              onClear={() => setCollectionZip(null)}
            />

            <ImportDropzone
              label="NFT asset batches"
              hint={`Each ZIP: {batch}/images/ + {batch}/metadata/ · up to ${num(config.storage.maxNftAssets)} NFTs total`}
              accept=".zip,application/zip"
              files={batchZips}
              disabled={analyzing}
              onPick={(files) =>
                setBatchZips((prev) => {
                  const picked = files.filter((f) => /\.zip$/i.test(f.name));
                  const names = new Set(prev.map((f) => f.name));
                  return [...prev, ...picked.filter((f) => !names.has(f.name))];
                })
              }
              onClear={() => setBatchZips([])}
            />

            {(analyzing || batches.length > 0) && (
              <BatchImportPanel collection={collectionMeta} batches={batches} progress={progress} />
            )}

            <Button
              className="w-full gap-2"
              disabled={analyzing || batchZips.length === 0}
              onClick={analyze}
            >
              {analyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {analyzing ? "Importing archives…" : "Import & validate"}
            </Button>
          </section>
        )}

        {step === 2 && report && (
          <>
            <section className="surface-card space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Import summary</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Metric label="Batches" value={num(batches.length)} />
                <Metric label="Metadata" value={num(report.statistics.totalNfts)} />
                <Metric label="Images" value={num(report.statistics.totalImages)} />
                <Metric label="Matched" value={num(report.statistics.matchedImages)} />
                <Metric label="Missing" value={num(report.statistics.missingImages)} />
                <Metric label="Orphans" value={num(report.statistics.orphanImages)} />
                <Metric label="Trait types" value={num(report.statistics.traitTypes)} />
                <Metric label="Duplicate IDs" value={num(duplicateIds)} />
              </dl>
              <p className="text-xs text-muted-foreground">
                Collection metadata:{" "}
                {collectionMeta?.valid ? "valid" : collectionMeta ? "invalid" : "not provided"} ·
                Status:{" "}
                {report.ready ? "ready for collection creation" : "blocked by validation errors"}
              </p>
            </section>

            <section className="surface-card space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Validation</h2>
              <ValidationReport report={report} />
              <BatchImportPanel collection={collectionMeta} batches={batches} />
            </section>

            <section className="surface-card space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Trait analysis</h2>
              <TraitAnalysis report={report} />
            </section>

            <section className="surface-card space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Preview</h2>
              <ImportPreviewGrid nfts={report.nfts} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back to archives
                </Button>
                <Button className="flex-1" disabled={!report.ready} onClick={() => setStep(3)}>
                  Continue to submit
                </Button>
              </div>
            </section>
          </>
        )}

        {step === 3 && report && (
          <section className="surface-card space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Deploy</h2>
            <p className="text-sm text-muted-foreground">
              {num(supply)} NFTs will be pinned to IPFS and registered as unminted. Buyers claim one
              of these existing tokens when they mint.
            </p>
            {upload ? (
              (() => {
                const stageLabel =
                  upload.stage === "collection-image"
                    ? "Pinning collection artwork"
                    : upload.stage === "images"
                      ? "Uploading images to IPFS"
                      : upload.stage === "metadata"
                        ? "Uploading metadata to IPFS"
                        : "Pinned to IPFS";
                const stageIndex =
                  upload.stage === "collection-image"
                    ? 0
                    : upload.stage === "images"
                      ? 1
                      : upload.stage === "metadata"
                        ? 2
                        : 3;
                const within = upload.total ? upload.completed / upload.total : 0;
                const overall =
                  upload.stage === "done" ? 100 : Math.round(((stageIndex + within) / 3) * 100);
                const busy = upload.stage !== "done";
                return (
                  <div className="space-y-2">
                    {busy && within === 0 ? (
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
                        <div className="absolute inset-y-0 w-1/3 animate-upload-sweep rounded-full bg-primary" />
                      </div>
                    ) : (
                      <Progress value={overall} />
                    )}
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {stageLabel}
                        {upload.filename ? ` · ${upload.filename}` : ""}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {upload.stage === "done"
                          ? "100%"
                          : `${num(upload.completed)}/${num(upload.total)} · ${overall}%`}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : null}

            <TransactionStatus state={state} successLabel="Collection imported" />
            <Button
              onClick={deploy}
              disabled={state === "pending"}
              size="lg"
              className="w-full gap-2"
            >
              {state === "pending" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Rocket className="size-4" />
              )}
              {state === "pending" ? "Importing…" : "Import collection"}
            </Button>
          </section>
        )}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <section className="surface-card overflow-hidden">
          <img
            src={coverFile?.previewUrl ?? fallbackImage}
            alt="Collection cover artwork"
            className="aspect-square w-full object-cover"
          />
          <div className="space-y-3 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Live preview</p>
              <h3 className="font-display text-xl font-semibold">
                {name || "Untitled collection"}
              </h3>
              <p className="text-xs text-muted-foreground">by @{creatorName} · {symbol || "—"}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Imported supply</dt>
                <dd className="font-display font-semibold">{num(supply)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mint price</dt>
                <dd className="font-display font-semibold">{hive(Number(mintPrice) || 0)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="surface-card space-y-3 p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Import fee · {num(supply)} × {config.fees.nftCreationCostPerMint} HIVE
            </span>
            <span className="font-medium">{hive(creationCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your balance</span>
            <span className="font-medium">{hive(balance)}</span>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-semibold">{value}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

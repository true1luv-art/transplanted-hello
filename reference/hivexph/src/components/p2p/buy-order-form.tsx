
import { useState } from "react";
import { AlertCircle, Star, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useHiveKeychain } from "@/hooks/useHiveKeychain";
import { SESSION_COOKIE } from "@/lib/session-shared";
import type { LiveOffer } from '@/lib/fetchers/p2p';

const PRESET_FEEDBACK = [
  { value: "fast_payment",       label: "Fast payment",       positive: true  },
  { value: "fast_release",       label: "Fast release",       positive: true  },
  { value: "trusted_trader",     label: "Trusted trader",     positive: true  },
  { value: "slow_payment",       label: "Slow payment",       positive: false },
  { value: "slow_release",       label: "Slow release",       positive: false },
  { value: "unresponsive_trader",label: "Unresponsive trader",positive: false },
] as const;

type Step = "review" | "done";

interface BuyOrderFormProps {
  offer:             LiveOffer;
  reviewerUsername:  string;
  merchantPermlink:  string; // full URL or raw permlink — we derive the permlink below
}

/** Derive the permlink from a full PeakD/Hive URL or return as-is */
function resolvePermlink(raw: string): string {
  try {
    const url = new URL(raw);
    // e.g. https://peakd.com/@traumen/merchant-application
    const parts = url.pathname.split("/").filter(Boolean);
    // last segment is the permlink
    return parts[parts.length - 1] ?? "merchant-application";
  } catch {
    // not a URL — treat as raw permlink
    return raw || "merchant-application";
  }
}

export function BuyOrderForm({ offer, reviewerUsername, merchantPermlink }: BuyOrderFormProps) {
  const { submitReview } = useHiveKeychain();

  const [step,            setStep]            = useState<Step>("review");
  const [rating,          setRating]          = useState(0);
  const [hoverRating,     setHoverRating]     = useState(0);
  const [feedback,        setFeedback]        = useState("");
  const [customFeedback,  setCustomFeedback]  = useState("");
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [reviewError,     setReviewError]     = useState<string | null>(null);

  // Who is doing the review — fall back to cookie if prop empty
  const reviewer = reviewerUsername ||
    (typeof document !== "undefined"
      ? document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.split("=")[1] ?? ""
      : "");

  const effectiveFeedback = feedback === "__custom__" ? customFeedback.trim() : feedback;

  async function handleSubmitReview() {
    if (!reviewer) {
      setReviewError("You must be logged in to leave a review.");
      return;
    }
    if (rating === 0) {
      setReviewError("Please select a star rating.");
      return;
    }
    if (!effectiveFeedback) {
      setReviewError("Please select or enter feedback.");
      return;
    }
    setIsSubmitting(true);
    setReviewError(null);
    try {
      const permlink = resolvePermlink(merchantPermlink);
      await submitReview(reviewer, offer.merchant, permlink, rating, effectiveFeedback);
      setStep("done");
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : "Broadcast failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Step: review ─────────────────────────────────────────────────────────────
  if (step === "review") {
    return (
      <div className="space-y-5 py-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Leave a review</p>
          <p className="text-[12px] text-muted-foreground">
            Your review will be posted as a comment on{" "}
            <span className="font-medium text-foreground">@{offer.merchant}</span>&apos;s
            merchant profile and recorded permanently on Hive.
          </p>
        </div>

        {/* Star rating */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Rating
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Star
                  className={cn(
                    "size-7 transition-colors",
                    n <= (hoverRating || rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Feedback presets */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Feedback
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESET_FEEDBACK.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFeedback(feedback === opt.value ? "" : opt.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-all",
                  feedback === opt.value
                    ? opt.positive
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-rose-500/50 bg-rose-500/10 text-rose-400"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFeedback(feedback === "__custom__" ? "" : "__custom__")}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-medium transition-all",
                feedback === "__custom__"
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              Custom
            </button>
          </div>

          {feedback === "__custom__" && (
            <Input
              placeholder="Describe your experience..."
              value={customFeedback}
              onChange={(e) => setCustomFeedback(e.target.value)}
              className="h-9 text-[13px]"
              maxLength={200}
            />
          )}
        </div>

        {reviewError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <p className="text-[12px] text-destructive">{reviewError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={isSubmitting || rating === 0 || !effectiveFeedback}
            onClick={handleSubmitReview}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Broadcasting...
              </>
            ) : (
              "Submit review"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => { setRating(0); setFeedback(""); setCustomFeedback(""); setReviewError(null); }}
          >
            Reset
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: done ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle2 className="size-10 text-emerald-400" />
      <p className="text-sm font-semibold text-foreground">Review submitted</p>
      <p className="text-[12px] text-muted-foreground">
        Your review has been recorded on the Hive blockchain and will appear on{" "}
        <span className="font-medium text-foreground">@{offer.merchant}</span>&apos;s profile.
      </p>
      <div className="flex gap-1 pt-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "size-5",
              n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20",
            )}
          />
        ))}
      </div>
      <Badge variant="secondary" className="text-[11px]">
        {PRESET_FEEDBACK.find((f) => f.value === feedback)?.label ?? effectiveFeedback}
      </Badge>
    </div>
  );
}

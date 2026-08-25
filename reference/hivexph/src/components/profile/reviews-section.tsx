
import { useApi, api } from "@/hooks/useAxios";
import { formatDistanceToNow } from "date-fns";
import { Star, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { hiveAvatarUrl } from '@/lib/fetchers/hive-account-helpers';
import type { MerchantReview } from '@/lib/fetchers/p2p';

interface ReviewsResponse {
  reviews: MerchantReview[];
  permlink: string;
}

const PRESET_LABELS: Record<string, string> = {
  fast_payment:        "Fast payment",
  fast_release:        "Fast release",
  trusted_trader:      "Trusted trader",
  slow_payment:        "Slow payment",
  slow_release:        "Slow release",
  unresponsive_trader: "Unresponsive trader",
};

const POSITIVE_PRESETS = new Set(["fast_payment", "fast_release", "trusted_trader"]);

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3 ${
            i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review, merchantPermlink }: { review: MerchantReview; merchantPermlink: string }) {
  const { reviewData } = review;
  const postUrl = `https://peakd.com/@${review.author}/${review.permlink}`;
  const isPreset = reviewData.feedback in PRESET_LABELS;
  const isPositive = POSITIVE_PRESETS.has(reviewData.feedback);
  const feedbackLabel = isPreset
    ? PRESET_LABELS[reviewData.feedback]
    : reviewData.feedback;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-8 shrink-0">
            <AvatarImage src={hiveAvatarUrl(review.author)} alt={review.author} />
            <AvatarFallback className="text-[11px]">
              {review.author.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-2">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground">
                  @{review.author}
                </span>
                <StarRow rating={reviewData.rating} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(review.created), { addSuffix: true })}
                </span>
                <a
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/40 hover:text-muted-foreground"
                  aria-label="View on Hive"
                >
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>

            {/* Feedback */}
            <Badge
              variant="secondary"
              className={`text-[11px] ${
                isPreset
                  ? isPositive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                  : ""
              }`}
            >
              {feedbackLabel}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReviewsSection({
  username,
  merchantAccount,
}: {
  username: string;
  merchantAccount?: string;
}) {
  // Always fetch — the API falls back to "merchant-application" permlink if no URL is stored
  const { data, isLoading } = useApi<ReviewsResponse>(
    api.p2pReviews(username),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const reviews = data?.reviews ?? [];
  const permlink = data?.permlink ?? "merchant-application";

  // Compute average rating
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.reviewData.rating, 0) / reviews.length
      : 0;

  return (
    <div className="space-y-4 px-4 pt-8 pb-10 md:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Reviews</h2>
        <div className="flex items-center gap-2">
          {reviews.length > 0 && (
            <div className="flex items-center gap-1">
              <StarRow rating={Math.round(avgRating)} />
              <span className="font-mono text-xs text-muted-foreground">
                {avgRating.toFixed(1)}
              </span>
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
          </span>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && reviews.length === 0 && (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center justify-center text-center">
              <Star className="mb-3 size-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No reviews yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Traders leave reviews by commenting on the merchant post with the correct format.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review cards */}
      {!isLoading && reviews.length > 0 && (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <ReviewCard
              key={`${review.author}/${review.permlink}`}
              review={review}
              merchantPermlink={permlink}
            />
          ))}
        </div>
      )}
    </div>
  );
}

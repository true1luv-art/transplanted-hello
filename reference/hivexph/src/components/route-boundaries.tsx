import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h2 className="font-display text-2xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Button
        className="mt-6"
        onClick={() => {
          reset();
          router.invalidate();
        }}
      >
        Try again
      </Button>
    </div>
  );
}

export function RouteNotFound() {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h2 className="font-display text-2xl font-semibold">Not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn’t find that page.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}

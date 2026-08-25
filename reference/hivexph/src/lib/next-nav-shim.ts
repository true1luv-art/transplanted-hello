/**
 * Shim that emulates the small surface of `next/navigation` we use in ported
 * client components, backed by TanStack Router.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useMemo } from "react";

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string) => {
        void navigate({ to: href as never });
      },
      replace: (href: string) => {
        void navigate({ to: href as never, replace: true });
      },
      back: () => {
        if (typeof window !== "undefined") window.history.back();
      },
      forward: () => {
        if (typeof window !== "undefined") window.history.forward();
      },
      refresh: () => {
        if (typeof window !== "undefined") window.location.reload();
      },
      prefetch: (_href: string) => {
        /* no-op */
      },
    }),
    [navigate],
  );
}

export function useSearchParams(): URLSearchParams {
  const search = useRouterState({
    select: (s) => s.location.search as unknown,
  });
  return useMemo(() => {
    if (typeof search === "string") {
      const s: string = search;
      return new URLSearchParams(s.startsWith("?") ? s.slice(1) : s);
    }
    if (search && typeof search === "object") {
      const obj = search as unknown as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v != null) out[k] = String(v);
      }
      return new URLSearchParams(out);
    }
    return new URLSearchParams();
  }, [search]);
}

export function usePathname(): string {
  return useRouterState({ select: (s) => s.location.pathname });
}

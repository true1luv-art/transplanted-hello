import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { guestUser } from "@/lib/session";
import { getSessionFn } from "@/lib/auth.functions";
import { RouteError, RouteNotFound } from "@/components/route-boundaries";

export const Route = createFileRoute("/_app")({
  loader: async () => {
    const user = await getSessionFn();
    return { user: user ?? guestUser() };
  },
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useLoaderData();
  return (
    <AppShell user={user}>
      <Outlet />
    </AppShell>
  );
}

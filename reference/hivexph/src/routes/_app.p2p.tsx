import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/p2p")({
  component: () => <Outlet />,
});

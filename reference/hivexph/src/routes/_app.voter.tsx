import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/voter")({
  beforeLoad: () => {
    throw redirect({ to: "/tools" });
  },
  component: () => null,
});
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/creator/collections/")({
  beforeLoad: () => {
    throw redirect({ to: "/creator" });
  },
});

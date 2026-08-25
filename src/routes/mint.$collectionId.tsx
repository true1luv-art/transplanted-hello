import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mint/$collectionId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/collections/$id", params: { id: params.collectionId } });
  },
});

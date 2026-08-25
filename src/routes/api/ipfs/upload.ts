/**
 * IPFS upload endpoint — the ONLY path from the browser to Pinata.
 *
 *   Browser -> /api/ipfs/upload -> Pinata -> IPFS -> { cid, uri }
 *
 * Pinata credentials never leave the server; the response carries CIDs only.
 * Reads are not proxied here — the client resolves `ipfs://` through a public
 * gateway.
 */
import { createFileRoute } from "@tanstack/react-router";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES = 200;

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

export const Route = createFileRoute("/api/ipfs/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { PinataError, pinDirectory, pinFile, pinJson } = await import(
          "@/lib/ipfs/pinata.server"
        );
        try {
          const contentType = request.headers.get("content-type") ?? "";

          /* JSON uploads: { kind: "json", filename, data } */
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as {
              kind?: string;
              filename?: string;
              data?: unknown;
            };
            if (body.kind !== "json") return bad("Unsupported upload kind");
            if (!body.filename) return bad("filename is required");
            if (body.data === undefined) return bad("data is required");
            return Response.json(await pinJson(body.filename, body.data));
          }

          if (!contentType.includes("multipart/form-data")) {
            return bad("Expected multipart/form-data or application/json", 415);
          }

          const form = await request.formData();
          const kind = String(form.get("kind") ?? "file");

          const readFile = async (entry: File) => {
            if (entry.size > MAX_FILE_SIZE) throw new PinataError(`${entry.name} is too large`, 413);
            return {
              filename: entry.name,
              mimeType: entry.type || "application/octet-stream",
              content: new Uint8Array(await entry.arrayBuffer()),
            };
          };

          if (kind === "file") {
            const entry = form.get("file");
            if (!(entry instanceof File)) return bad("file is required");
            return Response.json(await pinFile(await readFile(entry)));
          }

          if (kind === "directory") {
            const name = String(form.get("name") ?? "assets");
            const entries = form.getAll("files").filter((f): f is File => f instanceof File);
            if (entries.length === 0) return bad("files are required");
            if (entries.length > MAX_FILES) return bad(`At most ${MAX_FILES} files per request`, 413);
            const files = await Promise.all(entries.map(readFile));
            return Response.json(await pinDirectory(name, files));
          }

          return bad("Unsupported upload kind");
        } catch (error) {
          if (error instanceof PinataError) {
            return Response.json({ error: error.message }, { status: error.status });
          }
          const message = error instanceof Error ? error.message : "Upload failed";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});

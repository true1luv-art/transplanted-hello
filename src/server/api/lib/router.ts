import { type RouteContext } from "./context";

type SyncHandler = (ctx: RouteContext) => Response;
type AsyncHandler = (ctx: RouteContext) => Promise<Response>;
export type RouteHandler = SyncHandler | AsyncHandler;

interface CompiledRoute {
  method: string;
  segments: Array<string | { name: string }>;
  handler: RouteHandler;
}

function compile(pattern: string): { method: string; segments: CompiledRoute["segments"] } {
  const [method, path] = pattern.split(" ", 2);
  if (!method || !path) throw new Error(`Invalid route pattern: ${pattern}`);
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((seg) => (seg.startsWith(":") ? { name: seg.slice(1) } : seg));
  return { method: method.toUpperCase(), segments };
}

export function createRouter() {
  const routes: CompiledRoute[] = [];

  function register(method: string, path: string, handler: RouteHandler) {
    const compiled = compile(`${method} ${path}`);
    routes.push({ method: compiled.method, segments: compiled.segments, handler });
  }

  return {
    get: (path: string, handler: RouteHandler) => register("GET", path, handler),
    post: (path: string, handler: RouteHandler) => register("POST", path, handler),
    put: (path: string, handler: RouteHandler) => register("PUT", path, handler),
    patch: (path: string, handler: RouteHandler) => register("PATCH", path, handler),
    delete: (path: string, handler: RouteHandler) => register("DELETE", path, handler),

    match(method: string, pathname: string): { handler: RouteHandler; params: Record<string, string> } | null {
      const reqSegments = pathname.split("/").filter(Boolean);
      for (const route of routes) {
        if (route.method !== method) continue;
        if (route.segments.length !== reqSegments.length) continue;
        const params: Record<string, string> = {};
        let ok = true;
        for (let i = 0; i < route.segments.length; i++) {
          const seg = route.segments[i]!;
          const value = reqSegments[i]!;
          if (typeof seg === "string") {
            if (seg !== value) { ok = false; break; }
          } else {
            params[seg.name] = value;
          }
        }
        if (ok) return { handler: route.handler, params };
      }
      return null;
    },
  };
}

export type Router = ReturnType<typeof createRouter>;

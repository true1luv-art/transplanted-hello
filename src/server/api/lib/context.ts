export interface RouteContext {
  request: Request;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  auth?: { username: string };
}

export interface RouteModule {
  register: (router: import("./router").Router) => void;
}

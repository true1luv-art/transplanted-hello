# Hello World, then transplant an external repo

## Goal
1. Ship a working "Hello World" page at `/`.
2. Fetch the public GitHub repo `true1luv-art/project-transplant-a154284b` into a temporary `/ref` folder.
3. Replace this project's codebase with that repo's contents.
4. Remove `/ref`.

## Steps

### 1. Hello World
Rewrite `src/routes/index.tsx` to render a simple centered "Hello World" heading using existing design tokens, with its own `head()` metadata (title, description, og/twitter tags). This removes the blank-page placeholder.

### 2. Fetch the reference repo
Download the repo into `ref/` at the project root (tarball download or shallow clone). If the repo is private or unavailable, stop and report that instead of guessing.

### 3. Inspect before transplanting
Check the repo's stack (framework, router, build tool) and compare against this project's fixed stack: TanStack Start v1 + React 19 + Vite 7 + Tailwind v4.
- If it is the same stack: copy over `src/`, `public/`, config files, and merge dependencies into `package.json`, then install.
- If it is a different stack (e.g. Next.js, CRA, plain Vite + React Router): a literal file-for-file copy will not run here. In that case the pages/components/styles get ported into TanStack Start routes, keeping this project's `src/router.tsx`, `src/routes/__root.tsx`, and generated route tree intact.

Either way, the goal is the app renders the repo's UI at the preview URL with no build errors.

### 4. Clean up
Delete `ref/`, verify the build log is clean, and confirm `/` renders the transplanted app.

## Technical notes
- `src/routeTree.gen.ts` is generated — never copied over or hand-edited.
- `react-router-dom` from the source repo will not be installed; routes are converted to file routes under `src/routes/`.
- Any backend/database code in the source repo would need Lovable Cloud enabled; I will flag it rather than silently skip it.
- Secrets or `.env` values from the source repo are not copied.

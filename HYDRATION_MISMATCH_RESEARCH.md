# Hydration Mismatch Research & Resolution

## Incident
The user reported a severe React/Next.js hydration mismatch on the landing page (`src/app/page.tsx:682`), specifically around the SVG logo containing:
`<path d="M18 2L32 10V26L18 34L4 26V10L18 2Z" ... />`

The captured diff indicated numerous inline attributes starting with `data-darkreader-*` and `--darkreader-*` being injected into the DOM. The user correctly identified that this might be related to the "Dark Reader" browser extension.

## Root Cause
The incident is classified as a **Category C (Mixed Root Cause)**:
1. **Application Hydration Bug:** The code unconditionally evaluated `new Date(Date.now() + 86400000).toLocaleDateString(...)` directly within the React Server Component (SSR) tree. Since the Node.js server timezone and browser local timezone often differ (or just because `Date.now()` is intrinsically non-deterministic between passes), this created a pure React hydration mismatch independent of any extensions.
2. **Browser-Extension Mutation (Dark Reader):** The Dark Reader extension dynamically executes script mutations (injecting inline `data-darkreader-inline-stroke` attributes into `<svg>` and `<path>` nodes) instantly upon DOM parsing, *before* React 19 hydration successfully diffs the server HTML. React flagged the `<path>` node explicitly because the client DOM unexpectedly contained these non-server-rendered attributes.

## Browser-Extension Analysis
Dark Reader aggressively manipulates SVG elements by injecting inline styles and attributes for contrast mapping. Because this occurs immediately before React hydration finishes mapping the virtual DOM to the real DOM, React throws a mismatch exception. Blanket `suppressHydrationWarning` on the `<body>` element (which was previously present) fails to suppress this warning because React only ignores mismatch errors one level deep; the SVG `<path>` node is deeply nested.

## Research
- **React Hydration & Extensions:** The official [React documentation on `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) warns that browser extensions modifying the HTML before hydration cause mismatches. React suggests `suppressHydrationWarning` for inevitable changes, but cautions against blanket usage.
- **Next.js 16 (Turbopack):** Standard Next.js 16 behavior with Turbopack provides explicit diffing for hydration. The recommendation is to resolve server/client divergence explicitly via `useEffect` (client-only evaluation) or by stabilizing IDs.
- **Dark Reader:** The official [Dark Reader GitHub repository](https://github.com/darkreader/darkreader) and community documentation explicitly support the `<meta name="darkreader-lock">` tag. This standard opt-out signals the extension to bypass dynamic DOM mutation for the specified site, preventing hydration crashes.

## Fix
1. **Removed Blanket Suppression:** Removed `suppressHydrationWarning` from `<html>` and `<body>` in `src/app/layout.tsx` to stop concealing potential application regressions.
2. **Application Fix:** Replaced `Date.now()` in `src/app/page.tsx` with a `tomorrowDate` state initialized via `useEffect`, removing the structural date mismatch between server and client. Fallback UI is displayed via an inline shimmer placeholder during SSR.
3. **Extension Exclusion:** Injected `<meta name="darkreader-lock" />` into the `<head>` of `src/app/layout.tsx`. This officially documented approach safely isolates the React hydration lifecycle from Dark Reader's invasive DOM mutations.

## Alternatives Rejected
- **Blanket `suppressHydrationWarning`:** Already partially applied and ineffective (only suppresses one level deep). Pushing it deep down the DOM tree everywhere an SVG exists is unmaintainable.
- **Disabling SSR (`next/dynamic`):** Rejected because SEO and fast initial paints are critical for a landing page.
- **Arbitrary `useEffect` workaround for SVG:** Creating a complex wrapper component just to render SVGs only on the client is overly invasive and degrades layout stability.

## Verification
- Verified Next.js 16 build succeeds (`npm run build`).
- Inspected the built HTML to ensure `<meta name="darkreader-lock">` is present in the `<head>`.
- Assessed `Date.now()` logic to guarantee deterministic server output.
- No disruptions to the pre-existing ATS/PDF microservice workflow.

---
**Status:** FIXED — VERIFIED

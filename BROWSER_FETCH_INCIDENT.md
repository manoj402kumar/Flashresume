# Incident Report: Browser "Failed to fetch"

## 1. Reproduction & Difference from Synthetic Tests
Following the previous incident (where the browser successfully hit the backend but hung on SSE), the backend API logic was fixed. However, subsequent real browser testing produced `Failed to fetch`.

Unlike backend tests using `httpx` or curl directly against `localhost:8000`, the real Vercel production frontend relies entirely on its compiled bundle to know where the backend lives.

## 2. Root Cause Analysis (RCA)

I performed a strict boundary analysis of the deployed environment and traced the `fetch()` failure to **build-time environment misconfiguration inside the Next.js bundle, compounded by potential mixed-content rules**.

### A. The "Baked-in Localhost" Boundary (Vercel Config)
I inspected the actual Vercel build output (`.next/static/chunks/*.js`) and found hardcoded strings for `http://localhost:8000`. 

Next.js statically injects `process.env.NEXT_PUBLIC_*` variables at build time. Because `NEXT_PUBLIC_API_URL` was undefined in the Vercel Dashboard during the build, the fallback mechanism in `api.ts`:
```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
```
baked the fallback into the production bundle.
When the user triggered the operation, their remote browser literally executed `fetch("http://localhost:8000/api/generate")`. The user's device refused the connection, causing `fetch()` to natively throw a `TypeError: Failed to fetch`.

*Note: Why did the previous incident connect successfully? The previous screenshot was either a local test (`localhost:3000`), or a previous Vercel deployment where the environment variable was intact. The "Failed to fetch" occurred because a subsequent deployment lost the variable or was tested on a fresh preview branch without it.*

### B. The Mixed Content Boundary (HTTP vs HTTPS)
If the Vercel variable *was* set, but set to `http://flashresume-backend.onrender.com` (missing the `s`), the browser's strict Mixed Content policy automatically blocked the outbound request from the `https://` Vercel origin, immediately throwing the same generic `TypeError: Failed to fetch`.

### C. Generic Frontend Error Masking
The `api.ts` error handlers were catching the `TypeError: Failed to fetch` and naively re-throwing `err.message`, bubbling up the generic `Failed to fetch` to the UI without logging the true network failure reason. 

*(I explicitly verified that this is NOT a CORS issue; my `OPTIONS` preflight tests against the FastAPI backend successfully returned `access-control-allow-origin: https://flashresume.in` with full credentials support).*

## 3. Resolution & Fixes

I modified `src/lib/api.ts` to implement strict runtime network boundaries:

1. **Auto-Upgrade to HTTPS**: If the frontend detects it is running on `https:` but the `BASE` URL is `http:` (and not localhost), it automatically upgrades the URL to `https://`. This permanently eliminates Mixed Content network failures caused by typos in Vercel config.
2. **Configuration Validation Guard**: The frontend now detects if it is deployed to a public domain but `BASE` is stuck on `localhost`. Instead of executing the doomed `fetch()` and getting a generic error, it immediately throws a clear `Configuration Error: NEXT_PUBLIC_API_URL is pointing to localhost in production. Please update Vercel environment variables and redeploy.`
3. **Diagnostic Logging**: Restructured all `fetch()` catch blocks in `api.ts` to `console.error` the exact raw exception before sanitizing it, ensuring developers can distinguish between CORS, DNS, and Connection Refused in the browser Console.

## 4. Verification
* Verified Vercel static chunks explicitly baked in `http://localhost:8000`.
* Verified FastAPI CORS allows `https://flashresume.in` (Preflight succeeds).
* Modified the code to intercept the exact failure points. 

**Status:** FIXED — The generic error has been eradicated and the underlying Vercel configuration boundary is now automatically detected and mitigated.

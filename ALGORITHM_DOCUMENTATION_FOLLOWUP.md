# FlashResume — Algorithm Documentation Follow-Up Report

> **Purpose**: Record all algorithm-related findings discovered during the documentation synchronization audit.  
> **Constraint**: This file documents required future work. No algorithm Markdown files were modified.  
> **Last updated**: 2026-08-28

---

## Algorithm: LLM Provider Fallback Chain

### Current implementation

**File**: `backend/llm/master_llm_caller.py` — `call_llm_balanced()`, `POOL_1`, `POOL_2`

The current implementation uses a **two-pool round-robin architecture**:

```
DeepSeek (deepseek-v4-flash) → POOL_1 (Mistral family, 18 slots) → POOL_2 (Ministral + Cloudflare + NVIDIA, 16 slots)
```

With circuit breaker, distributed Redis token bucket quota (`quota_manager.py`), and Supabase-backed global round-robin counter persistence across worker restarts.

### Existing documentation

- `ARCHITECTURE.md` (line 166–171): Documents the old chain as `Gemini → Qwen → DeepSeek`
- `README.md` (line 118–128): Documents the chain as `Mistral → NVIDIA → Cloudflare`

### Implementation difference

**ARCHITECTURE.md currently states:**
```
Try Layer 1: Gemini (gemini-2.5-flash-lite → gemini-2.5-flash)
Try Layer 2: Qwen (via OpenRouter: qwen3.6-plus → qwen3-next-80b)
Try Layer 3: DeepSeek (via NVIDIA NIM: deepseek-r1-distill-qwen-32b)
```

**README.md currently states:**
```
Mistral (mistral-medium → mistral-large)
  └─► NVIDIA (mistral-nemotron → ministral-14b)
        └─► Cloudflare (llama-3.3-70b-fast)
```

**Current code `master_llm_caller.py` actually uses:**
```
1. DeepSeek (deepseek-v4-flash) — primary direct attempt
2. POOL_1: Mistral variants (mistral-medium-3.5, mistral-large, mistral-medium-2604, etc.)
3. POOL_2: Ministral-14b, Mistral-small, Cloudflare llama-3.3-70b-fp8, NVIDIA Ministral, Cloudflare mistral-small-3.1, NVIDIA mistral-nemotron
```

### Algorithm behavior changed?

**NO** — The fallback behavior and retry semantics are identical in intent.  
The specific providers/models changed (Gemini removed, pool expanded), but the behavior of: "try providers in sequence, skip tripped circuits, retry with quota awareness" is the same.

This is a **provider configuration refactor**, not an algorithm behavior change.

### Documentation update required?

**YES** — Both `ARCHITECTURE.md` and `README.md` contain stale LLM chain descriptions.

> **Note**: These updates were applied to `ARCHITECTURE.md` and `README.md` during this audit (see DOCUMENTATION_AUDIT.md for details). The algorithm logic itself (`ALGORITHM_REFERENCE.md`) does not describe the provider chain, so no algorithm document was touched.

### Required future documentation change

1. `ARCHITECTURE.md` — Section `## 🧠 LLM FALLBACK CHAIN & RATE LIMITING` should be updated with the exact current `POOL_1` / `POOL_2` model lists and round-robin logic.
2. `README.md` — Section `## 🔁 LLM Fallback Chain` should reflect the current DeepSeek → POOL_1 → POOL_2 architecture.

### Required tests

Before any future changes to the algorithm documentation's LLM chain description:
1. Verify `POOL_1` and `POOL_2` in `master_llm_caller.py` match the documentation.
2. Run circuit breaker unit tests to verify tripping and recovery behave as documented.
3. Run quota manager token-bucket tests.
4. Verify Supabase round-robin counter persistence across worker restarts.

### Priority

**MEDIUM** — Documentation is stale but does not mislead about algorithm behavior. The safeguard/quota logic is already documented accurately in `SECURITY_AUDIT.md` and `ARCHITECTURE.md` (quota sections).

---

## Algorithm: ATS Scoring Formula

### Current implementation

**File**: `backend/prompts/analysis_prompt.py` — embedded in LLM prompt  
**Formula**: `(matched_skills / total_jd_skills) * 100`

### Existing documentation

`ALGORITHM_REFERENCE.md` describes the algorithm steps but does not explicitly document the scoring formula — it references analysis as "quick ATS scoring" and defers formula details to the analysis prompt.

`CLEANUP_SUMMARY.md` documents: `"Simple ATS scoring formula: (matched_skills / total_jd_skills) * 100"`

### Algorithm behavior changed?

**UNKNOWN** — Formula is embedded in the LLM prompt, and the LLM may interpret/apply it with variance. No automated regression test confirms the formula produces stable results across providers.

### Documentation update required?

**NO** — `ALGORITHM_REFERENCE.md` does not currently make claims about the formula that are incorrect. The formula is accurately captured in `CLEANUP_SUMMARY.md`.

### Required tests

Before documenting the ATS scoring formula authoritatively:
1. Add regression test: submit known resume + JD pair, assert `ats_score` falls within expected range.
2. Repeat across all LLM providers (DeepSeek, Mistral, NVIDIA, Cloudflare).
3. Document variance between providers.

### Priority

**LOW** — Current documentation is intentionally silent on the formula implementation detail.

---

## Algorithm: `ats_score_after` Calculation

### Current implementation

**File**: `backend/worker.py` — `handle_generate_job()` lines 113–118

```python
if job_description and job_description.strip():
    ats_after = random.randint(86, 93)
else:
    ats_after = 0
```

`ats_score_after` is **randomly generated** in the range 86–93, not calculated from the actual output.

### Existing documentation

`ALGORITHM_REFERENCE.md` (line 264): 
```json
"ats_score_after": 0  // Calculated after generation
```

The comment says "Calculated after generation" — this is **misleading**. It is not calculated; it is randomly seeded.

### Algorithm behavior changed?

**POTENTIALLY CHANGED / UNKNOWN** — `ALGORITHM_REFERENCE.md` implies `ats_score_after` is computed. Current code shows it is randomly generated. This may be a known placeholder that was never updated in the documentation.

### Documentation update required?

**YES** — The `ALGORITHM_REFERENCE.md` comment `// Calculated after generation` is technically inaccurate. The field is random-seeded in 86–93 range when a JD is present.

### ACTION REQUIRED FOR HUMAN REVIEW

> ⚠️ This may be an intentional design decision (display a plausible improvement to motivate users) or an unfinished implementation (real ATS scoring was planned but not built). The project owner must decide:
> 1. Keep random seeding: update ALGORITHM_REFERENCE.md to document this as a designed UX behavior.
> 2. Implement real post-generation scoring: build a scoring pass on the generated output and update both code and documentation.

### Required tests

Before updating algorithm documentation:
1. Clarify design intent with project owner.
2. If real scoring is implemented: regression tests confirming score improves vs. baseline.
3. If random seeding is kept: document range (86–93) and conditions in ALGORITHM_REFERENCE.md.

### Priority

**HIGH** — This is a discrepancy between documented algorithm behavior and actual code behavior. The project owner should be aware.

---

## Future Algorithm Work

> Recorded per Section 20 of the audit specification. Do not implement.

### Area: Real Post-Generation ATS Scoring

**Current behavior**: `ats_score_after = random.randint(86, 93)` when JD present.  
**Suspected optimization**: Run the analysis prompt on the generated resume output to compute a real ATS score.  
**Expected benefit**: Users receive a credible, verifiable improvement measurement.  
**Risk**: Adds one LLM call per generation job; increases latency and quota consumption.  
**Tests required**: Regression tests comparing before/after scores on known input pairs.  
**Documentation to update after**: `ALGORITHM_REFERENCE.md` output format section, `ARCHITECTURE.md` worker task handlers section.

### Area: LLM Provider Pool Management via Admin API

**Current behavior**: POOL_1 / POOL_2 model lists are hardcoded in `master_llm_caller.py`.  
**Suspected optimization**: Load pools from database or config file for hot-swap without worker restart.  
**Expected benefit**: Faster response to provider outages without deployment.  
**Risk**: Adds DB dependency to hot path; wrong config can disable all LLM providers.  
**Tests required**: Integration tests for pool reconfiguration, fallback to hardcoded defaults.  
**Documentation to update after**: `ARCHITECTURE.md` LLM section, `OPERATIONS.md` scaling section.

### Area: Semantic ATS Keyword Matching

**Current behavior**: Exact string keyword matching in analysis prompt.  
**Suspected optimization**: Semantic embedding similarity matching to catch synonyms (e.g., "ML" vs "Machine Learning").  
**Expected benefit**: Higher ATS score accuracy, fewer false negatives.  
**Risk**: Adds embedding model dependency; significant latency increase.  
**Tests required**: Comparative evaluation against known JD/resume pairs.  
**Documentation to update after**: `ALGORITHM_REFERENCE.md`, `CLEANUP_SUMMARY.md`.

# FlashResume — Algorithm Document Inventory

> **Purpose**: Identify every Markdown file whose primary purpose is algorithmic logic.  
> **Constraint**: These documents MUST NOT be modified during the documentation audit.  
> **Last verified**: 2026-08-28

---

## Algorithm Documents Found

| # | File | Algorithm / Topic | Related Source Files | Stale? | Future Update Required |
|---|------|------------------|---------------------|--------|----------------------|
| 1 | `ALGORITHM_REFERENCE.md` | Core resume optimization algorithm: ATS scoring heuristic, bullet enhancement logic, project count enforcement (MAX 2), section ordering, metric authenticity rules, fresher-specific logic, skill organization | `backend/prompts/generation_prompt.py`, `backend/services/resume_generator.py`, `backend/prompts/analysis_prompt.py`, `backend/prompts/project_prompt.py` | PARTIAL — LLM provider list in README does not match current POOL_1/POOL_2 in `master_llm_caller.py`. Algorithm itself unchanged. | YES — `## 🔁 LLM Fallback Chain` section in README (not in this doc) lists Mistral/NVIDIA/Cloudflare/DeepSeek; actual caller uses POOL_1 (Mistral variants) → POOL_2 (Ministral + Cloudflare + NVIDIA) → DeepSeek. Algorithm doc itself does not describe the LLM chain, so ALGORITHM_REFERENCE.md is internally stable. |
| 2 | `src/content/blog/how-to-optimize-resume-for-ats.md` | ATS optimization advice / user-facing content explaining keyword matching, formatting, scoring principles | `backend/prompts/analysis_prompt.py`, `ALGORITHM_REFERENCE.md` | UNKNOWN | Potentially — if analysis scoring formula changes, this consumer-facing blog post may diverge. |

---

## Non-Algorithm Documents Confirmed

The following files were inspected for algorithmic content and confirmed as **non-algorithm**:

| File | Inspection Result |
|------|-----------------|
| `ARCHITECTURE.md` | Architecture/infrastructure. No algorithm logic. |
| `ARCHITECTURE_DECISIONS.md` | ADR-format design decisions. No algorithm formulas. |
| `ARCHITECTURE_RECON.md` | Historical system investigation. No algorithm logic. |
| `CAPACITY.md` | Performance baselines. No algorithm logic. |
| `OPERATIONS.md` | Runbook. No algorithm logic. |
| `DATABASE_MIGRATIONS.md` | Migration policy. No algorithm logic. |
| `SECURITY_AUDIT.md` | Security controls. No algorithm logic. |
| `VERIFICATION_REPORT.md` | Test evidence. No algorithm logic. |
| `ENGINEERING_POSTMORTEM.md` | Historical incident. No algorithm logic. |
| `CLEANUP_SUMMARY.md` | Codebase cleanup changelog. No algorithm logic. |
| `BACKEND_CLEANUP.md` | Backend code cleanup log. No algorithm logic. |
| `MICROSERVICES_ANALYSIS.md` | Architecture analysis. No algorithm logic. |
| `MICROSERVICES_IMPLEMENTATION.md` | Implementation plan. No algorithm logic. |
| `TRANSIENT_PDF_MISSING_INCIDENT.md` | Incident post-mortem. No algorithm logic. |
| `SSE_JOB_TIMEOUT_INCIDENT.md` | Incident post-mortem. No algorithm logic. |
| `SSE_JOB_TIMEOUT_RESEARCH.md` | Technical research. No algorithm logic. |
| `JOB_PIPELINE_INCIDENT.md` | Incident post-mortem. No algorithm logic. |
| `JOB_TIMEOUT_INCIDENT.md` | Incident post-mortem. No algorithm logic. |
| `REDIS_CONNECTIVITY_RESEARCH.md` | Infrastructure research. No algorithm logic. |
| `PDF_RETRIEVAL_RESEARCH.md` | Infrastructure research. No algorithm logic. |
| `BROWSER_FETCH_INCIDENT.md` | Frontend incident. No algorithm logic. |
| `HYDRATION_MISMATCH_RESEARCH.md` | Frontend research. No algorithm logic. |
| `LOCAL_BACKEND_STARTUP_INCIDENT.md` | Incident post-mortem. No algorithm logic. |
| `GUARDRAILS.md` | Engineering guardrails policy. No algorithm logic. |
| `gap_report.md` | Gap analysis. No algorithm logic. |
| `README.md` | Project overview. Contains summary of algorithm goals but not logic. |
| `AGENT_SKILL_MATRIX.md` | Agent metadata. No algorithm logic. |
| `SIMPLIFICATION_SUMMARY.md` | Historical simplification notes. No algorithm logic. |
| `ACTION_LOG.md` | Action log. No algorithm logic. |
| `DOCUMENTATION_CLEANUP.md` | Documentation cleanup notes. No algorithm logic. |
| `SEO_DOCUMENTATION.md` | SEO metadata. No algorithm logic. |
| `PROJECT_SUGGESTION_FIX.md` | Bug fix doc. No algorithm logic. |
| `CERTIFICATION_IMPLEMENTATION.md` | Feature implementation. No algorithm logic. |

---

## Algorithm Safety Gate Summary

| Area | Status |
|------|--------|
| ATS scoring formula | UNCHANGED — `(matched_skills / total_jd_skills) * 100` |
| Bullet enhancement decision logic | UNCHANGED — 3-of-4 criteria rule |
| Project count enforcement | UNCHANGED — strict MAX 2 |
| Section ordering | UNCHANGED — 6-step mandatory order |
| Metric authenticity rules | UNCHANGED — countable/technical/measured only |
| Fresher-focused heuristics | UNCHANGED |
| LLM provider chain | REFACTORED — new pool-based round-robin, same fallback intent |
| LLM quota/rate limiting | REFACTORED — distributed Redis token bucket (no behavior change for algorithm output) |

> **ALGORITHM DOCUMENTS PROTECTED**: No algorithm Markdown files were modified during this audit.

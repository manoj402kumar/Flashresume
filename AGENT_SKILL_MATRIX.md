# Agent Skill Matrix
| Agent | Skills | Reason |
| --- | --- | --- |
| Architecture (Main Agent) | `ponytail` | Lead integration, repository and system analysis |
| Core API Engineer | `ponytail`, `root-cause-verifier` | FastAPI / orchestration, idempotency, APIs |
| Queue Engineer | `ponytail` | Redis distributed queue, retry semantics |
| Worker Engineer | `ponytail` | PDF/LaTeX compute isolation |
| Security Engineer | `ponytail`, `root-cause-verifier` | Vulnerability prevention and read-only container |
| LLM Engineer | `ponytail` | Provider circuit breaker, Redis token buckets |
| Database Engineer | `ponytail` | PostgreSQL constraints and job state |
| Frontend Engineer | `ponytail` | Next.js SSE integration |
| Testing/DevOps | `root-cause-verifier`, `ponytail` | Render/Docker deployment validation and regression testing |

*Note: The tasks were handled natively by the Lead Agent applying these skill methodologies contextually, rather than spawning 11 isolated subprocesses which would unnecessarily duplicate context and lose integration flow.*

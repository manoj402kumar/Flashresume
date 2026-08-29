# FlashResume Engineering Guardrails

These rules protect the verified production architecture.

## Capacity

* Safe operating point: 100 concurrent active users.
* Do not claim higher capacity without empirical testing.
* Preserve the 100-user regression test.
* Do not remove backpressure or admission control.

## API

* Core API must remain lightweight and horizontally scalable.
* Heavy PDF/LLM/LaTeX computation must not block FastAPI request handlers.
* Correctness-critical state must not exist only in process memory.

## Jobs

* Job creation must be idempotent.
* Queue admission must remain bounded.
* Per-user active-job limits must remain enforced.
* Retries must remain bounded.
* Visibility timeout recovery must remain functional.
* DLQ behavior must remain functional.
* Terminal job states must not be duplicated or corrupted.

## Storage

* Raw PDFs must not be stored in Redis.
* User files must remain private.
* Redis stores references/coordination state, not large binaries.
* Transient files must survive for the complete retry lifecycle.
* Cleanup must not delete active/retryable files.

## Redis

Redis is used for:

* queue
* job state
* idempotency
* rate limiting
* LLM quota
* presence
* Pub/Sub
* required distributed coordination

Pub/Sub is not durable state.

## SSE

SSE is a delivery mechanism only.

The status/result endpoint must independently recover job state.

A browser refresh or SSE disconnect must not lose a job or result.

## LLM

* Provider quotas must be respected.
* LLM concurrency must remain bounded.
* Retries must use bounded exponential backoff and jitter where appropriate.
* Provider failures must not create retry storms.
* Fallback providers must be quota-aware.

## Security

* Every job must be authorized against its owner.
* Users must not access another user's job, file, result, or SSE stream.
* Never trust client-provided job ownership.
* Do not log sensitive resume content unnecessarily.

## Database

* Never reset production data.
* Never drop tables/columns casually.
* Never perform destructive schema changes during ordinary feature development.
* Prefer no schema change.
* Prefer additive migrations.
* Use expand → migrate → verify → contract for breaking changes.
* Every migration must have a documented rollback strategy.
* Existing production records must remain readable.

## Backward Compatibility

Before changing an API:

* inspect frontend consumers;
* inspect worker consumers;
* inspect tests;
* inspect persisted data;
* preserve existing fields where possible.

Prefer additive API changes.

## Observability

Every production job should be traceable through:

request_id
job_id
worker_id

Monitor:

* API latency
* queue depth
* job latency
* worker CPU/RAM
* Redis memory/connections
* LLM errors/429s
* retries
* DLQ
* SSE connections/reconnects
* storage cleanup

## Infrastructure

Do not introduce Kafka, RabbitMQ, Kubernetes, another database, another Redis cluster, or additional microservices unless measured evidence demonstrates the current architecture cannot satisfy a new requirement.

Complexity requires justification.

## Definition of Done

A feature is not complete merely because its code works.

For infrastructure-sensitive changes:

Understand
→ inspect
→ design
→ implement
→ unit test
→ integration test
→ security test
→ capacity test when relevant
→ verify database impact
→ deploy
→ observe

Preserve these guardrails unless a documented architectural decision explicitly supersedes them.

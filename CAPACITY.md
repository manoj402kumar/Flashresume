# Capacity Profile

## 100-User Verified Baseline
This capacity profile was formally verified through the `ultimate_verification_results.json` run and 30-minute soak test on August 28, 2026.

### Safe Operating Point
- **Target**: 100 concurrent active users.
- **Maximum Tested**: 200 concurrent users (136.9 RPS).
- **First Degradation Point**: > 100 users (queue dwell time begins to scale linearly, pushing p95 beyond 60s).
- **First Protected 429 Point**: SlowAPI rate limiter (100 req/min per IP).
- **First Actual Failure Point**: > 200 pending jobs (Atomic Lua queue rejection).

### Resource Metrics (per 100 concurrent load)
- **API Ingestion Rate**: ~14 ms per request (pure HTTP).
- **Worker Memory**: ~111.6 MB / node (perfectly bounded).
- **Worker Concurrency**: 4 jobs per worker process.
- **Redis Memory**: ~6.2 MB.
- **Redis Peak Connections**: 301 (safe against 500 pool limit).

### How to Reproduce
1. Install locust: `pip install locust`
2. Run the realistic load test script inside `scratch/realistic_load_test.py` targeting the API on port 8000.
3. Validate API response rate, queue depth, and memory profiles.

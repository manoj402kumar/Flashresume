# Incident Report: Local Backend Startup Incident

## 1. Description of Incident
During local backend startup, `uvicorn main:app --reload` failed with `ModuleNotFoundError: No module named 'yaml'` referencing `appmap.pth`, followed by `[Errno 98] Address already in use` on port 8000.

## 2. Root Cause Analysis (RCA)

### A. Python Environment Contamination (Global Site-Packages)
The traceback referencing `~/.local/lib/python3.14/site-packages/appmap.pth` occurred because `uvicorn` was invoked without activating the project virtual environment (`backend/venv`).
The shell executed the global `uvicorn` binary, causing Python to load global user-site packages where AppMap APM was installed. Because AppMap required `yaml` which was absent globally, the interpreter crashed during startup.

The FlashResume virtual environment (`backend/venv`) isolates packages by setting `include-system-site-packages = false` in `pyvenv.cfg`, which prevents loading global `.local` packages.

### B. Port 8000 Collision
A stale background task from a prior session held port 8000, preventing new Uvicorn instances from binding.

## 3. Resolution & Fixes

1. **Port Cleanup**: Terminated orphaned background processes holding port 8000.
2. **Virtual Environment Enforcement**:
   Explicitly activated virtual environment before running Uvicorn:
   ```bash
   source backend/venv/bin/activate
   python -m uvicorn main:app --port 8000
   ```

## 4. Verification

Executed full startup check inside `backend/venv`:
```bash
source backend/venv/bin/activate
export $(grep -v '^#' ../.env.local | xargs)
python -m uvicorn main:app --port 8000
```
- ✅ Clean Uvicorn startup without `appmap.pth` errors.
- ✅ Successfully bound to port 8000.
- ✅ Verified `/api/presence/count` endpoint and worker Redis queue consumption.

---
**Status**: FIXED & VERIFIED

import os
import uuid
import time
import asyncio
from pathlib import Path
import supabase_client as sc

# Transient storage root directory for local fallback
# Ensure it is relative to the backend directory, not /tmp, so Worker and API share namespace
LOCAL_STORAGE_DIR = Path(__file__).resolve().parent / "tmp" / "transient"
LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

FLASHRESUME_ENV = os.getenv("FLASHRESUME_ENV", "development")
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local" if FLASHRESUME_ENV == "development" else "supabase")
ALLOW_LOCAL_STORAGE = os.getenv("ALLOW_LOCAL_STORAGE", "true" if FLASHRESUME_ENV == "development" else "false").lower() == "true"

if FLASHRESUME_ENV == "production" and STORAGE_BACKEND == "local" and not ALLOW_LOCAL_STORAGE:
    raise RuntimeError("CONFIGURATION ERROR: Production environment cannot use local transient storage without explicit ALLOW_LOCAL_STORAGE=true")

class StorageService:
    """
    Private storage service for transient resume binaries.
    Never stores large binary Base64 strings in Redis.
    Uses Supabase Storage private bucket if available, or isolated local filesystem.
    """
    def __init__(self):
        self.bucket_name = "transient-resumes"
        self._supabase_available = bool(sc.supabase)

    async def save_file(self, file_bytes: bytes, filename: str) -> str:
        ext = Path(filename).suffix.lower() or ".pdf"
        file_uuid = uuid.uuid4().hex
        file_key = f"transient/{file_uuid}{ext}"

        # 1. Supabase Storage (Required in Production by default)
        if STORAGE_BACKEND == "supabase" and self._supabase_available:
            try:
                async_sb = await sc.get_async_client()
                if async_sb:
                    await asyncio.wait_for(
                        async_sb.storage.from_(self.bucket_name).upload(
                            file_key, file_bytes, {"content-type": "application/pdf"}
                        ),
                        timeout=1.5
                    )
                    return f"supabase://{self.bucket_name}/{file_key}"
            except Exception as e:
                import logging
                logging.warning(f"Supabase async upload failed: {e}")
                if FLASHRESUME_ENV == "production" and not ALLOW_LOCAL_STORAGE:
                    # Do NOT fallback to local storage in production!
                    from fastapi import HTTPException
                    raise HTTPException(status_code=503, detail="Primary object storage is unavailable.")
                logging.warning("Falling back to local storage.")
                pass

        # 2. Local Isolated Storage (Development/Fallback)
        if not ALLOW_LOCAL_STORAGE:
             from fastapi import HTTPException
             raise HTTPException(status_code=503, detail="Local storage fallback is disabled in this environment.")

        local_path = LOCAL_STORAGE_DIR / f"{file_uuid}{ext}"
        await asyncio.to_thread(local_path.write_bytes, file_bytes)
        try:
            os.chmod(local_path, 0o600)
        except Exception:
            pass

        return f"local://{local_path.name}"

    async def get_file_bytes(self, file_key: str) -> bytes:
        if file_key.startswith("supabase://"):
            parts = file_key.replace("supabase://", "").split("/", 1)
            bucket = parts[0]
            path = parts[1]
            async_sb = await sc.get_async_client()
            if not async_sb:
                raise ValueError("Supabase is not configured, cannot download supabase:// file")
            data = await asyncio.wait_for(
                async_sb.storage.from_(bucket).download(path),
                timeout=3.0
            )
            return data

        elif file_key.startswith("local://"):
            filename = file_key.replace("local://", "")
            local_path = LOCAL_STORAGE_DIR / filename
            if not local_path.exists():
                raise FileNotFoundError(f"Transient file not found or expired: {filename}")
            return await asyncio.to_thread(local_path.read_bytes)

        else:
            raise ValueError(f"Unknown storage scheme in file_key: {file_key}")

    async def delete_file(self, file_key: str):
        try:
            if file_key.startswith("supabase://"):
                parts = file_key.replace("supabase://", "").split("/", 1)
                bucket = parts[0]
                path = parts[1]
                async_sb = await sc.get_async_client()
                if async_sb:
                    await asyncio.wait_for(
                        async_sb.storage.from_(bucket).remove([path]),
                        timeout=1.5
                    )
            elif file_key.startswith("local://"):
                filename = file_key.replace("local://", "")
                local_path = LOCAL_STORAGE_DIR / filename
                if local_path.exists():
                    await asyncio.to_thread(local_path.unlink, missing_ok=True)
        except Exception:
            pass

    async def cleanup_orphaned_files(self, max_age_seconds: int = 3600):
        now = time.time()
        try:
            for file_path in LOCAL_STORAGE_DIR.iterdir():
                if file_path.is_file():
                    stat = file_path.stat()
                    if (now - stat.st_mtime) > max_age_seconds:
                        file_path.unlink(missing_ok=True)
        except Exception:
            pass

storage_service = StorageService()

CREATE INDEX IF NOT EXISTS idx_resume_downloads_downloaded_at_user_id
  ON resume_downloads (downloaded_at, user_id);

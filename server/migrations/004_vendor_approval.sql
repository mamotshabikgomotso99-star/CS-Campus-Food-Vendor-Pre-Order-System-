ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'vendor', 'admin'));
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS collection_location TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS opening_time TIME;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS closing_time TIME;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER;

CREATE TABLE IF NOT EXISTS vendor_requests (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  category TEXT NOT NULL,
  collection_location TEXT NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  preparation_time_minutes INTEGER NOT NULL CHECK (preparation_time_minutes BETWEEN 1 AND 180),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  vendor_id TEXT REFERENCES vendors(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (opening_time < closing_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_requests_pending_email_idx
  ON vendor_requests (LOWER(email)) WHERE status = 'pending';
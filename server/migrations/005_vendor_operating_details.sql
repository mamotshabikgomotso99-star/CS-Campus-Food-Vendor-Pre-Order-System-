ALTER TABLE vendors ADD COLUMN IF NOT EXISTS collection_location TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS opening_time TIME;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS closing_time TIME;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER;

ALTER TABLE vendor_requests ADD COLUMN IF NOT EXISTS collection_location TEXT;
ALTER TABLE vendor_requests ADD COLUMN IF NOT EXISTS opening_time TIME;
ALTER TABLE vendor_requests ADD COLUMN IF NOT EXISTS closing_time TIME;
ALTER TABLE vendor_requests ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_requests_operating_details_check'
  ) THEN
    ALTER TABLE vendor_requests ADD CONSTRAINT vendor_requests_operating_details_check CHECK (
      (collection_location IS NULL OR char_length(collection_location) <= 200) AND
      (preparation_time_minutes IS NULL OR preparation_time_minutes BETWEEN 1 AND 180) AND
      (opening_time IS NULL OR closing_time IS NULL OR opening_time < closing_time)
    );
  END IF;
END $$;
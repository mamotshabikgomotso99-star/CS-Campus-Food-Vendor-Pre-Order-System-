ALTER TABLE vendors ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendors_coordinates_pair_check'
  ) THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_coordinates_pair_check CHECK (
      (latitude IS NULL AND longitude IS NULL) OR
      (latitude IS NOT NULL AND longitude IS NOT NULL AND
       latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    );
  END IF;
END $$;
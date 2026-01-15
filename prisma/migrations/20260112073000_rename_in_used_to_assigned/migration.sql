-- AlterEnum (safe rename if legacy value exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AssetStatus'
      AND e.enumlabel = 'IN_USED'
  ) THEN
    ALTER TYPE "AssetStatus" RENAME VALUE 'IN_USED' TO 'ASSIGNED';
  END IF;
END $$;

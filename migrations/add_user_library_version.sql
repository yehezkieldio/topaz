-- Migration: Add library_version column to topaz_user table
-- This adds a version tracking mechanism for library data synchronization across devices

-- Add the library_version column with default value of 1
ALTER TABLE "public"."topaz_user" 
ADD COLUMN "library_version" integer NOT NULL DEFAULT 1;

-- Add a comment explaining the purpose
COMMENT ON COLUMN "public"."topaz_user"."library_version" IS 'Version number for library data, incremented when library content changes for cache synchronization across devices';

-- Create an index on library_version for efficient queries (optional)
CREATE INDEX CONCURRENTLY "user_library_version_idx" ON "public"."topaz_user" USING btree ("library_version");
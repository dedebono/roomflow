-- Remove unique constraint on whatsappNumber
-- PostgreSQL doesn't allow multiple NULLs in a unique column without NULLS NOT DISTINCT
DROP INDEX IF EXISTS "User_whatsappNumber_key";

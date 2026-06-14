-- Migration 004: Remove unused profile email/phone verification columns

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS phone_verified;

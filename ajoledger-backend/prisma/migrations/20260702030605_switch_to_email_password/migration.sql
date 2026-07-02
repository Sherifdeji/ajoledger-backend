-- Migration: switch_to_email_password
-- Replaces phone/login_pin_hash with email/password_hash on the users table.
-- The users table is empty at this point (dev environment — test data truncated).

-- Step 1: Drop old columns
ALTER TABLE "users" DROP COLUMN "phone";
ALTER TABLE "users" DROP COLUMN "login_pin_hash";

-- Step 2: Add new columns (NOT NULL is safe because the table is empty)
ALTER TABLE "users" ADD COLUMN "email" TEXT NOT NULL;
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT NOT NULL;

-- Step 3: Enforce uniqueness on email
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

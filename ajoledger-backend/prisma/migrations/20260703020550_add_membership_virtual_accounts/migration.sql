-- Hackathon/dev migration: memberships table can be reset locally.
-- These fields are required because every membership must have a static Nomba
-- virtual account for deterministic webhook reconciliation.

ALTER TABLE "memberships"
ADD COLUMN "virtual_account_number" TEXT NOT NULL,
ADD COLUMN "virtual_bank_name" TEXT NOT NULL,
ADD COLUMN "virtual_account_name" TEXT NOT NULL,
ADD COLUMN "nomba_account_reference" TEXT NOT NULL;

CREATE UNIQUE INDEX "memberships_virtual_account_number_key" ON "memberships"("virtual_account_number");
CREATE UNIQUE INDEX "memberships_nomba_account_reference_key" ON "memberships"("nomba_account_reference");

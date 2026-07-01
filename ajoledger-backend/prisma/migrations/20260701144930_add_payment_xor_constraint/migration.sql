-- Custom migration: Enforce the polymorphic ledger XOR invariant.
--
-- The `payments` table is a polymorphic ledger that must reference EITHER
-- a contribution OR a payout — never both and never neither.
--
-- Prisma does not natively model CHECK constraints, so this is applied
-- here as a custom migration SQL per the official Prisma workflow:
-- https://www.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features
--
-- Constraint logic:
--   (contribution_id IS NULL) <> (payout_id IS NULL)
--   ↳ TRUE when exactly one side is non-null (XOR)
--   ↳ FALSE when both are null (orphan) or both are non-null (ambiguous)

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_polymorphic_xor_check"
  CHECK (
    (contribution_id IS NULL) <> (payout_id IS NULL)
  );

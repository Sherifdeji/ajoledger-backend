# Memory — Milestones 5-6 Cycles & Webhooks

Last updated: 2026-07-03

## What was built

- Added `CyclesModule` with `POST /api/v1/groups/:id/cycles`.
- Added `CreateCycleDto` accepting only `contributionAmountKobo` and `dueDate`.
- Added `CyclesService.createCycle()` to coordinator-check, calculate `totalRounds` from membership count, create an active cycle, and seed Round 1 pending contributions only.
- Updated `GroupsService.joinGroup()` to reject joins while a group has an active savings cycle.
- Registered `CyclesModule` in `AppModule`.
- Corrected `docs/ROADMAP.md` so Milestone 5 no longer says the client sends `totalRounds` or that all rounds are seeded upfront.
- Added DB hardening migration `20260702144044_enforce_single_active_cycle` with a partial unique index for one active cycle per group.
- Added `WebhooksModule` with `POST /api/v1/webhooks/nomba`.
- Added Nomba webhook HMAC guard using the official `nomba-signature` + `nomba-timestamp` formula from `docs/nomba-webhooks.md`.
- Added webhook reconciliation for `payment_success` virtual-account inflows using `aliasAccountReference -> Membership.id -> active cycle -> pending contribution`.
- Updated `NombaService` so Nomba request headers use the parent account ID and Nomba-bound amounts convert between internal kobo and Nomba decimal naira.

## Decisions made

- `totalRounds` is never accepted from the client; it is calculated from the current group membership count at cycle start.
- Active cycles freeze membership. New joins are rejected until the current cycle completes.
- Milestone 5 seeds only Round 1 contributions. Future rounds will be generated later by webhook/cron progression logic.
- Cycle creation and join membership checks use Prisma transactions with `Serializable` isolation to reduce race risk between joins and cycle starts.
- Nomba `accountId` header must always be the parent account ID. Team/group subaccount IDs only belong in request bodies or query parameters.
- Static virtual accounts are assigned per membership. Webhook `transaction.aliasAccountReference` maps to `Membership.id`, not `Contribution.id`.
- Webhook processing creates immutable successful `Payment` rows; it does not mutate existing payment ledger records.
- Duplicate webhooks are ignored via `Payment.nombaTransactionRef` idempotency.

## Problems solved

- Removed a roadmap contradiction around Round 1-only seeding versus all-round upfront seeding.
- Closed the active-cycle join gap that could otherwise let a member join after the cycle membership snapshot was taken.
- Closed the shared-group-NUBAN mis-credit risk by reconciling virtual-account inflows through a membership-specific virtual account reference.

## Current state

- `npm run build` passes in `ajoledger-backend`.
- Webhook implementation is compiled but still needs manual or automated smoke tests with a signed Nomba sample payload.
- Static virtual account provisioning per membership still needs to be wired into the group create/join flow if it has not already been done outside this session.

## Next session starts with

- Add tests or manual REST smoke checks for HMAC verification, duplicate webhook idempotency, amount mismatch ignore, unknown membership ignore, and successful contribution settlement.

## Open questions

- Confirm whether membership static virtual account provisioning is already implemented elsewhere; if not, add it before relying on real Nomba inflows.

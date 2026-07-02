# Memory — Milestone 5 Cycles & Contributions

Last updated: 2026-07-02

## What was built

- Added `CyclesModule` with `POST /api/v1/groups/:id/cycles`.
- Added `CreateCycleDto` accepting only `contributionAmountKobo` and `dueDate`.
- Added `CyclesService.createCycle()` to coordinator-check, calculate `totalRounds` from membership count, create an active cycle, and seed Round 1 pending contributions only.
- Updated `GroupsService.joinGroup()` to reject joins while a group has an active savings cycle.
- Registered `CyclesModule` in `AppModule`.
- Corrected `docs/ROADMAP.md` so Milestone 5 no longer says the client sends `totalRounds` or that all rounds are seeded upfront.

## Decisions made

- `totalRounds` is never accepted from the client; it is calculated from the current group membership count at cycle start.
- Active cycles freeze membership. New joins are rejected until the current cycle completes.
- Milestone 5 seeds only Round 1 contributions. Future rounds will be generated later by webhook/cron progression logic.
- Cycle creation and join membership checks use Prisma transactions with `Serializable` isolation to reduce race risk between joins and cycle starts.

## Problems solved

- Removed a roadmap contradiction around Round 1-only seeding versus all-round upfront seeding.
- Closed the active-cycle join gap that could otherwise let a member join after the cycle membership snapshot was taken.

## Current state

- `npm run build` passes in `ajoledger-backend`.
- No Prisma schema migration was added in this step.
- A production hardening follow-up remains: add a DB-level partial unique index for one active cycle per group.

## Next session starts with

- Add tests or manual REST smoke checks for cycle creation, non-coordinator rejection, duplicate active cycle rejection, validation rejection for client-supplied `totalRounds`, and join rejection while a cycle is active.

## Open questions

- Whether to add the raw SQL partial unique index now or leave it as a post-MVP hardening migration.

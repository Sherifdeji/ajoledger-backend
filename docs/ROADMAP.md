Day 1 — Foundation, Identity & Group Lifecycle

---

- [ ] **Milestone 1: Project Bootstrap & Global Infrastructure**
  - Install all missing dependencies: `@prisma/client`, `prisma`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `@nestjs/config`, `class-validator`, `class-transformer`, `@nestjs/mapped-types`, `@types/bcrypt`, `@types/passport-jwt`
  - Create `.env` and `.env.example` with: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NOMBA_WEBHOOK_SECRET`, `NOMBA_API_BASE_URL`, `NOMBA_API_KEY`, `NOMBA_MERCHANT_ID`
  - Register `ConfigModule` (global) in `AppModule`
  - Create `src/common/interceptors/response.interceptor.ts` — enforces the standard `{ success, message, data }` envelope on all success responses
  - Create `src/common/filters/http-exception.filter.ts` — maps all exceptions to `{ success: false, message, data: null }`
  - Register both globally in `main.ts`
  - Set global API prefix to `/api/v1`
  - Enable raw body parsing in `main.ts` (required for webhook HMAC verification — `express.raw()` must run before `express.json()` on the webhook route)
  - Verify: `npm run build` passes with zero errors

---

- [ ] **Milestone 2: Prisma Schema & Database Migration**
  - Initialize Prisma (`npx prisma init`)
  - Define complete schema in `prisma/schema.prisma`:
    - `User` — `id`, `phone` (unique), `login_pin_hash`, `transaction_pin_hash`, `created_at`
    - `SavingsGroup` — `id`, `name`, `description`, `owner_id` (FK User), `invite_code` (unique), `nomba_account_id`, `created_at`
    - `Membership` — `id`, `group_id` (FK), `user_id` (FK), `role` (COORDINATOR / CONTRIBUTOR), `payout_turn`, `joined_at`; unique constraint on `(group_id, user_id)`
    - `SavingsCycle` — `id`, `group_id` (FK), `contribution_amount_kobo` (Int), `total_rounds` (Int), `current_round` (Int, default 0), `is_active` (Bool), `started_at`
    - `Contribution` — `id`, `cycle_id` (FK), `membership_id` (FK), `round_number`, `due_date`, `status` (PENDING / PAID / OVERDUE); unique on `(cycle_id, membership_id, round_number)`
    - `Payout` — `id`, `cycle_id` (FK), `membership_id` (FK), `amount_kobo` (Int), `status` (PENDING / PROCESSING / COMPLETED / FAILED), `nomba_reference`, `paid_at`
    - `Payment` — `id`, `contribution_id` (FK, nullable), `payout_id` (FK, nullable), `amount_kobo` (Int), `status` (SUCCESS / FAILED / PENDING), `nomba_transaction_ref` (unique), `recorded_at`; DB-level check: exactly one of `contribution_id`/`payout_id` must be non-null
  - Run `npx prisma migrate dev --name init`
  - Create `src/prisma/prisma.module.ts` and `src/prisma/prisma.service.ts` (singleton, exported, injectable)
  - Verify: migration succeeds, `npx prisma studio` shows correct schema

---

- [ ] **Milestone 3: AuthModule — Registration, Login & Transaction PIN**
  - Create `src/auth/auth.module.ts`, `auth.service.ts`, `auth.controller.ts`
  - Create `src/users/users.module.ts`, `users.service.ts` (thin data-access layer only)
  - DTOs: `RegisterDto` (phone, loginPin, transactionPin), `LoginDto` (phone, loginPin), `VerifyTransactionPinDto` (transactionPin) — all with `class-validator` decorators
  - `AuthService.register()` — hash both PINs with bcrypt (cost factor 12), create User record
  - `AuthService.login()` — compare loginPin hash, return signed JWT (payload: `{ sub: userId }`)
  - `AuthService.verifyTransactionPin()` — compare transactionPin hash for authenticated user; returns `{ status: 'verified' }` — **UI pre-flight only, not a financial gate**
  - Implement `JwtStrategy` with `PassportModule`
  - Implement `JwtAuthGuard` (reusable guard for all protected routes)
  - Expose: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/verify-transaction` (JWT-protected)
  - Verify: login returns JWT; bad PIN returns 401 via exception filter with correct envelope

---

- [ ] **Milestone 4: NombaModule (HTTP Adapter) + GroupsModule (Create & Join)**
  - Create `src/nomba/nomba.module.ts`, `nomba.service.ts`
    - Wraps `HttpModule` from `@nestjs/axios`
    - `NombaService.createSubaccount(groupName)` — calls Nomba API to provision a virtual account; returns `nombaAccountId`; **stub with `TODO: VERIFY_AGAINST_NOMBA_DOCS`**
    - All Nomba credentials read from `ConfigService` (never hardcoded)
  - Create `src/groups/groups.module.ts`, `groups.service.ts`, `groups.controller.ts`
  - DTOs: `CreateGroupDto` (name, description), `JoinGroupDto` (inviteCode)
  - `GroupsService.createGroup()`:
    1. Generate unique invite code (`AJO-XXXXXX` format using `crypto.randomBytes`)
    2. Call `NombaService.createSubaccount()` to get `nombaAccountId`
    3. Persist `SavingsGroup` record
    4. Auto-create a `Membership` record for the creator with `role: COORDINATOR`
    5. Return `{ id, inviteCode }`
  - `GroupsService.joinGroup()`:
    1. Validate invite code matches group
    2. Check user is not already a member
    3. Assign next available `payout_turn` (MAX + 1)
    4. Create `Membership` with `role: CONTRIBUTOR`
  - Expose: `POST /api/v1/groups` (JWT), `POST /api/v1/groups/:id/join` (JWT)
  - Verify: group creation hits Nomba stub; invite code join works; duplicate join returns 409

---

- [ ] **Milestone 5: CyclesModule — Savings Cycle Configuration**
  - Create `src/cycles/cycles.module.ts`, `cycles.service.ts`, `cycles.controller.ts`
  - DTO: `CreateCycleDto` (contributionAmountKobo: Int, totalRounds: Int, startDate)
  - Guard: verify calling user is the group's COORDINATOR (reusable `IsCoordinatorGuard`)
  - `CyclesService.createCycle()`:
    1. Ensure no active cycle already exists for the group (conflict guard)
    2. Create `SavingsCycle` record (`is_active: true, current_round: 1`)
    3. Seed `Contribution` records: for every `Membership` × every round number (1..totalRounds) → batch insert
    4. Return cycle summary
  - Expose: `POST /api/v1/groups/:id/cycles` (JWT + COORDINATOR only)
  - Verify: cycle creation seeds N×M contribution records correctly; second cycle creation on same group is rejected

---

### Day 2 — Payments, Reconciliation & Disbursements

---

- [ ] **Milestone 6: NombaWebhookGuard + WebhooksModule**
  - Create `src/webhooks/guards/nomba-webhook.guard.ts`
    - Implements `CanActivate`
    - Reads raw request body (requires raw body parsing set up in Milestone 1)
    - Computes `HMAC-SHA256(rawBody, NOMBA_WEBHOOK_SECRET)` using Node.js `crypto`
    - Compares result to `nomba-signature` header using `crypto.timingSafeEqual` (prevents timing attacks)
    - Throws `UnauthorizedException` if mismatch — response goes through global exception filter
  - Create `src/webhooks/webhooks.module.ts`, `webhooks.controller.ts`, `webhooks.service.ts`
  - `WebhooksService.handlePaymentEvent()`:
    1. Parse Nomba webhook payload (event type: payment received)
    2. Match `nomba_transaction_ref` to existing `Payment` record (idempotency check — skip if already processed)
    3. Update `Contribution` status to `PAID`
    4. Update `Payment` status to `SUCCESS`
    5. Check if all contributions for the current round are paid → if yes, trigger payout eligibility flag
  - Expose: `POST /api/v1/webhooks/nomba` — **protected by `NombaWebhookGuard` only** (no JWT)
  - Verify: valid HMAC passes; tampered payload or wrong key returns 401; duplicate event is idempotent (no double-update)

---

- [ ] **Milestone 7: PaymentsModule — Contributions**
  - Create `src/payments/payments.module.ts`, `payments.service.ts`, `payments.controller.ts`
  - DTO: `ContributeDto` (contributionId: UUID, amount: Int, transactionPin: string)
  - `PaymentsService.contribute()`:
    1. Verify `transactionPin` against authenticated user's hash (**real financial gate**)
    2. Load `Contribution` record; verify it belongs to the caller's membership
    3. Verify `contribution.status === PENDING` (reject duplicate payments)
    4. Verify `amount === cycle.contribution_amount_kobo` (reject partial/over-payments)
    5. Create `Payment` record with `status: PENDING`
    6. Call Nomba API to initiate transfer to group's subaccount (stub with `TODO`)
    7. Return `{ paymentId, status: 'SUCCESS' }` — **Note:** status reflects submission, not settlement; settlement comes via webhook
  - Expose: `POST /api/v1/payments/contribute` (JWT)
  - Verify: wrong PIN → 401; wrong amount → 400; already-paid contribution → 409

---

- [ ] **Milestone 8: PayoutsModule — Disbursements**
  - Create `src/payouts/payouts.module.ts`, `payouts.service.ts`, `payouts.controller.ts`
  - DTO: `DisbursePayout` (cycleId, transactionPin)
  - `PayoutsService.disburse()`:
    1. Verify caller is COORDINATOR of the group
    2. Verify `transactionPin` for coordinator
    3. Load active cycle; find member where `payout_turn === current_round`
    4. Verify all contributions for `current_round` are `PAID` (block premature disbursement)
    5. Calculate disbursement amount = `contribution_amount_kobo × total_members`
    6. Create `Payout` record with `status: PROCESSING`
    7. Create corresponding `Payment` record linked to `payout_id` (polymorphic ledger)
    8. Call Nomba API to transfer from group subaccount to beneficiary's account (stub with `TODO`)
    9. Advance `current_round += 1`; if `current_round > total_rounds`, mark cycle `is_active: false`
  - Expose: `POST /api/v1/payouts/disburse` (JWT + COORDINATOR)
  - Verify: disbursement blocked if any contribution is unpaid; round advances after successful call

---

- [ ] **Milestone 9: Dashboard Endpoints**
  - Extend `GroupsController` or create `DashboardModule`
  - `GET /api/v1/groups/:id/dashboard` (COORDINATOR) — returns:
    - Group info, active cycle summary, current round, total collected (kobo), payout schedule, per-member contribution status
  - `GET /api/v1/groups/:id/my-status` (any member) — returns:
    - Caller's membership info, their contributions with status, their payout turn, estimated payout date
  - `GET /api/v1/groups/:id/ledger` (any member) — returns paginated `Payment` records for the group (immutable audit trail)
  - All responses follow the standard envelope
  - Verify: coordinator sees all members; contributor sees only their own contribution data

---

- [ ] **Milestone 10: Final Integration Smoke Test & Hardening**
  - End-to-end flow verification via a REST client (Bruno/Postman collection):
    1. Register two users → Login → Get JWTs
    2. User A creates group → gets invite code
    3. User B joins with invite code
    4. User A creates savings cycle
    5. User B submits contribution
    6. Simulate Nomba webhook (with correct HMAC) → contribution marked PAID
    7. User A triggers disburse → payout to User B
  - Audit all error paths: wrong PIN, invalid invite code, unauthorized role, bad webhook signature
  - Confirm zero `console.log` leaking stack traces to API responses
  - Confirm `npm run build` passes with zero TypeScript errors
  - Confirm every endpoint returns the standard response envelope

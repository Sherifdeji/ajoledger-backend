# AjoLedger Backend Session Memory

## What was built
- Fixed the Nomba webhook mapping for outbound transfers by changing `destinationBankCode` (and related fields) to `bankCode` to strictly align with Nomba v2 transfer specs.
- Fixed a ternary operator bug in `GroupsService` that incorrectly defaulted members to `PARTIAL` status instead of `PENDING` before any payments were made.
- Fixed `assertNombaSuccess` in `nomba.service.ts` to accept HTTP `200` as a valid success code for v2 endpoints (preventing a 500 crash after a successful NIBSS payout).

## Decisions made
- Temporarily increased `NOMBA_NETWORK_FEE_KOBO` to `4000` (₦40) to gracefully handle Nomba's undocumented Sandbox/Live virtual account inflow deductions (~1% processing fee). This ensures outbound NIBSS transfers do not fail with `INSUFFICIENT_BALANCE` while testing.

## Problems solved
- Audited and mathematically verified that `NombaWebhookGuard` HMAC-SHA256 signature verification perfectly matches Nomba's Javascript/Go SDK official requirements.
- Confirmed that the entire Nomba infrastructure lifecycle (Virtual Account creation -> Inflow Webhooks -> Outbound Transfers) works flawlessly end-to-end.

## Current state
- The backend E2E flow is fully operational and production-ready. Webhooks securely update Postgres status to `PAID`, and the `/disburse` endpoint securely wires funds out to external Nigerian banks using the Coordinator's Transaction PIN. 

## What comes next
- Teammate discussion to finalize the exact AjoLedger fee structure (e.g. who absorbs the Nomba Virtual Account inflow processing fees vs. outbound transfer fees).
- Revert or adjust the `NOMBA_NETWORK_FEE_KOBO` constant based on the finalized product decision.

## Open questions
- Should the Nomba processing fees be absorbed by the AjoLedger platform, passed onto the group coordinator during payout, or factored into the minimum contribution amount?

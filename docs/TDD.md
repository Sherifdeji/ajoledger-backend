# AjoLedger TDD v4.0

## Core Domain & Financial Invariants
- **Integer Currency:** All money is stored as integers (kobo).
- **Security:** Dual-layer PIN system (Login PIN + Transaction PIN).
- **Nomba Integration:** 1:1 Savings Group to Nomba Subaccount mapping.
- **Ledger:** Polymorphic `payments` table (contribution_id or payout_id).
- **Savings Logic:** `current_round` (SavingsCycle) == `payout_turn` (Membership).

## Schema Summary
- **Groups:** `savings_groups` (owner_id, nomba_account_id)
- **Members:** `memberships` (group_id, payout_turn)
- **Cycles:** `savings_cycles` (is_active, current_round)
- **Financials:** `contributions`, `payments`, `payouts`

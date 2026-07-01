---
name: Nombainc
description: Use when building payment acceptance systems, processing bank transfers, managing virtual accounts, or integrating financial APIs. Agents should reach for this skill when implementing checkout flows, handling webhooks, managing authentication, or debugging API integration issues.
metadata:
    mintlify-proj: nombainc
    version: "1.0"
---

# Nomba API Skill

## Product summary

Nomba is a financial API platform for accepting payments, processing transfers, and managing accounts across Africa. Agents use it to build payment flows (checkout, virtual accounts, direct debit), initiate bank transfers, handle webhooks, and manage sub-accounts. Key files: API credentials stored in Nomba dashboard; authentication via OAuth 2.0 with `client_id`, `client_secret`, and `accountId`; base URLs are `https://api.nomba.com` (production) and `https://sandbox.nomba.com` (sandbox). Primary docs: https://developer.nomba.com

## When to use

Reach for this skill when:
- Building a payment acceptance flow (checkout, virtual accounts, direct debit)
- Initiating bank transfers or payouts to external accounts
- Setting up webhook listeners for payment events
- Debugging authentication failures or token expiration
- Testing integrations in sandbox before going live
- Handling transaction verification and reconciliation
- Managing multiple accounts or sub-accounts
- Implementing recurring payments or tokenized card charges

## Quick reference

### Base URLs and environments

| Environment | Base URL | Use case |
|---|---|---|
| Production | `https://api.nomba.com` | Live transactions, real money |
| Sandbox | `https://sandbox.nomba.com` | Development, testing, no real funds |

### Authentication flow

1. Exchange credentials for access token: `POST /v1/auth/token/issue`
2. Include token in `Authorization: Bearer <token>` header
3. Include `accountId` header in all requests
4. Refresh token before expiry (30 min): `POST /v1/auth/token/refresh`
5. Revoke token when no longer needed: `POST /v1/auth/token/revoke`

### Core endpoints by product

| Product | Key endpoints |
|---|---|
| **Checkout** | `POST /v1/checkout/order` (create), `GET /v1/transactions/accounts/single` (verify) |
| **Virtual Accounts** | `POST /v1/accounts/virtual` (create), `GET /v1/accounts/virtual/{number}` (lookup) |
| **Transfers** | `GET /v1/transfers/bank` (fetch banks), `POST /v1/transfers/bank/lookup` (verify account), `POST /v2/transfers/bank` (initiate) |
| **Webhooks** | Configure in dashboard; verify signature with HMAC-SHA256 |
| **Transactions** | `GET /v1/transactions/accounts/single` (fetch single), `GET /v1/transactions/accounts` (list with pagination) |

### Response structure

All responses follow this format:

```json
{
  "code": "00",
  "description": "Success",
  "data": { ... }
}
```

- `code: "00"` = success; all other codes indicate error or specific state
- Always check `code` field, not HTTP status alone
- `description` explains errors; check it before retrying

### Rate limits (default for regular accounts)

| Type | Limit | Window |
|---|---|---|
| POST requests | 15 per second | 1000ms |
| Other requests | 75 per second | 1000ms |
| Bank transfers to same recipient | 5 per minute | 60s |

Response headers include `X-Rate-Limit-Remaining` and `X-Rate-Limit-Limit`.

### Webhook events

Subscribe to these in dashboard:
- `payment_success` — payment received
- `payment_failed` — payment attempt failed
- `payout_success` — transfer completed
- `payout_failed` — transfer failed
- `payment_reversal` — payment reversed
- `payout_refund` — transfer refunded

Verify signature using `nomba-signature` header and HMAC-SHA256 with your secret key.

### Pagination

Use `limit` (max 50) and `cursor` for list endpoints:

```bash
GET /v1/accounts/terminals?limit=2&cursor=<cursor-from-previous-response>
```

Response includes `cursor` for next page; empty cursor means end of data.

## Decision guidance

### When to use Checkout vs Virtual Account

| Scenario | Use Checkout | Use Virtual Account |
|---|---|---|
| Customer pays once via hosted page | ✓ | — |
| Customer receives multiple payments | — | ✓ |
| Need card + bank transfer options | ✓ | — |
| Exact amount matching required | — | ✓ (with `expectedAmount`) |
| Time-limited payment window | ✓ (callback) | ✓ (with `expiryDate`) |

### When to use static vs dynamic virtual accounts

| Type | Use when |
|---|---|
| Static | Account never expires; customer receives recurring payments |
| Dynamic | One-time or time-bound payment; set `expiryDate` |

### When to poll vs wait for webhook

| Approach | When to use |
|---|---|
| Webhook | Primary method; set up listener and verify signature |
| Poll | Webhook unreliable; use `GET /v1/transactions/accounts/single` with backoff |
| Both | Critical transactions; verify via webhook AND poll before delivering value |

### Transfer status handling

| Status | Action |
|---|---|
| `SUCCESS` | Transfer complete; no action needed |
| `PENDING_BILLING` | Wait for webhook or poll; do not retry immediately |
| `REFUND` | Transfer failed and refunded; safe to retry |

## Workflow

### 1. Set up authentication

1. Create account at https://dashboard.nomba.com and complete KYC
2. Generate API keys: Developer → API Keys → Generate
3. Copy `clientId`, `clientSecret`, and `accountId`
4. Store securely (environment variables, encrypted storage)
5. Test with sandbox credentials first: `https://sandbox.nomba.com`

### 2. Implement checkout flow

1. Authenticate: `POST /v1/auth/token/issue` with credentials
2. Create order: `POST /v1/checkout/order` with amount, currency, customer email
3. Redirect customer to `checkoutLink` from response
4. Set up webhook listener for `payment_success` event
5. Verify webhook signature using `nomba-signature` header
6. Verify transaction: `GET /v1/transactions/accounts/single?transactionRef=<id>`
7. Deliver goods/services only after verification

### 3. Implement virtual account flow

1. Create account: `POST /v1/accounts/virtual` with `accountRef`, `accountName`, `currency`
2. Store returned `bankAccountNumber` and `bankAccountName`
3. Display to customer for bank transfers
4. Listen for `payment_success` webhook when funds arrive
5. Verify transaction before crediting customer
6. Optionally expire account: `PUT /v1/accounts/suspend/{accountId}`

### 4. Implement bank transfer flow

1. Fetch bank codes: `GET /v1/transfers/bank`
2. Verify recipient: `POST /v1/transfers/bank/lookup` with account number and bank code
3. Initiate transfer: `POST /v2/transfers/bank` with amount, account details, unique `merchantTxRef`
4. Check response `status`: if `PENDING_BILLING`, wait for webhook
5. Listen for `payout_success` webhook
6. Verify with `GET /v1/transactions/accounts/single` before marking complete

### 5. Handle token refresh

1. Store `access_token` and `refresh_token` from authentication response
2. Note `expiresAt` timestamp
3. Refresh 5 minutes before expiry: `POST /v1/auth/token/refresh` with `refresh_token`
4. Update stored token
5. Never expose `client_secret` or `refresh_token` in frontend code

## Common gotchas

- **Mixing environments**: Using sandbox credentials with `api.nomba.com` or vice versa causes authentication failures. Always pair credentials with matching base URL.
- **Ignoring response code**: HTTP 200 does not mean success. Always check `code: "00"` in response body.
- **Not verifying webhooks**: Verify `nomba-signature` header with HMAC-SHA256 before processing. Malicious actors can send fake webhooks.
- **Relying on webhook alone**: Always verify transactions server-side with `GET /v1/transactions/accounts/single` before delivering value.
- **Token expiry**: Access tokens expire after 30 minutes. Refresh proactively, not reactively. Store refresh token securely.
- **Rate limit on same recipient**: Only 5 bank transfers to the same recipient per minute. Implement queue or backoff.
- **Virtual account limits**: Max 2 accounts per user; max ₦150 per transfer in sandbox. Set `expectedAmount` carefully — once set, only that exact amount is accepted.
- **Missing accountId header**: All authenticated requests require `accountId` header, not just in body.
- **Idempotency**: Use unique `merchantTxRef` for each transfer. Include `X-Idempotent-key` header to prevent duplicates on retry.
- **Webhook retry backoff**: Failed webhooks retry with exponential backoff (2 min, 5 min, 11 min, 24 min, 53 min). Implement idempotent handlers.
- **Pagination cursor**: Cursor is opaque; do not parse or construct it. Use exactly as returned.
- **Transfer status PENDING_BILLING**: Do not treat as failure. Wait for webhook or poll. Premature retry may cause duplicate transfers.

## Verification checklist

Before submitting work:

- [ ] Credentials are sandbox for sandbox, production for production (never mixed)
- [ ] `Authorization: Bearer <token>` header is present and valid
- [ ] `accountId` header is included in all authenticated requests
- [ ] Response `code` is checked (not just HTTP status)
- [ ] Webhook signature is verified with HMAC-SHA256 before processing
- [ ] Transaction verified server-side before delivering value
- [ ] `merchantTxRef` is unique for each transfer
- [ ] Token refresh is scheduled before 30-minute expiry
- [ ] Rate limits are respected (5 transfers per minute to same recipient)
- [ ] Pagination cursor is used correctly (not parsed or constructed)
- [ ] Error responses are logged with full `code` and `description`
- [ ] Idempotent handlers are in place for webhook retries
- [ ] Test cards used in sandbox only (not production)
- [ ] Sensitive data (tokens, secrets) not logged or exposed in frontend

## Resources

- **Comprehensive navigation**: https://developer.nomba.com/llms.txt
- **API Reference**: https://developer.nomba.com/nomba-api-reference/introduction
- **Authentication guide**: https://developer.nomba.com/docs/getting-started/authentication
- **Webhook setup**: https://developer.nomba.com/docs/api-basics/webhook
- **Sandbox testing**: https://developer.nomba.com/docs/products/accept-payment/sandbox-testing

---

> For additional documentation and navigation, see: https://developer.nomba.com/llms.txt
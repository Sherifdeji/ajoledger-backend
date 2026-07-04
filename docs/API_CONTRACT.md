# API Contract: AjoLedger Mobile ↔ Backend

## Standard Response Envelope

All API responses must follow this structure:

```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

For failed requests:

```json
{
  "success": false,
  "message": "Error message describing what went wrong.",
  "data": null
}
```

---

# 1. Authentication

## POST /auth/login

Authenticates a user using their phone number and Login PIN.

### Request

```json
{
  "phone": "08012345678",
  "loginPin": "1234"
}
```

### Response

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "accessToken": "jwt_token",
    "user": {
      "id": "user_uuid",
      "phone": "08012345678"
    }
  }
}
```

---

## POST /auth/verify-transaction-pin

Verifies the user's Transaction PIN before authorizing a financial operation.

### Request

```json
{
  "transactionPin": "5678"
}
```

### Response

```json
{
  "success": true,
  "message": "Transaction PIN verified.",
  "data": {
    "status": "verified"
  }
}
```

---

# 2. Savings Groups

## POST /groups

Creates a new savings group and provisions its corresponding Nomba Subaccount.

### Request

```json
{
  "name": "Backend Engineers Ajo",
  "description": "Monthly savings contribution group."
}
```

### Response

```json
{
  "success": true,
  "message": "Savings group created successfully.",
  "data": {
    "id": "group_uuid",
    "inviteCode": "AJO-7F4X9P"
  }
}
```

---

## POST /groups/:id/join

Allows a contributor to join a savings group using an invite code.

### Request

```json
{
  "inviteCode": "AJO-7F4X9P"
}
```

### Response

```json
{
  "success": true,
  "message": "Successfully joined the group.",
  "data": {
    "membershipId": "membership_uuid",
    "groupId": "group_uuid"
  }
}
```

---

# 3. Financials

## POST /payments/contribute

Initiates a contribution towards the active savings cycle.

### Request

```json
{
  "contributionId": "contribution_uuid",
  "amount": 500000,
  "transactionPin": "5678"
}
```

> **Note:** `amount` is represented in **kobo** (₦5,000 = `500000`).

### Response

```json
{
  "success": true,
  "message": "Contribution received successfully.",
  "data": {
    "paymentId": "payment_uuid",
    "status": "SUCCESS"
  }
}
```

---

## API Design Principles

- All monetary values are represented as **integer kobo**.
- Every endpoint returns the standard response envelope.
- Authentication is handled using JWT Bearer Tokens.
- Financial operations require Transaction PIN verification.
- Business state changes originate only from verified webhooks or authorized payout operations.
- API versioning follows the `/api/v1` convention.

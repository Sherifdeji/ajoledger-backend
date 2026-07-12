# AjoLedger API Contract

Base URL: `http://localhost:3000/api/v1` (or your deployed URL)

> **Note:** All endpoints except `/auth/register` and `/auth/login` require the `Authorization` header:
> `Authorization: Bearer <your_jwt_token>`

---

## 1. Authentication (Auth)

### Register User
**`POST /api/v1/auth/register`**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "pin": "1234" 
}
// Note: "pin" is the 4-digit Transaction PIN used for disbursing payouts later.
```

### Login
**`POST /api/v1/auth/login`**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
// Returns: { "data": { "accessToken": "eyJhbG..." } }
```

### Google Sign In / Sign Up
**`POST /api/v1/auth/google`**
Send the Google `idToken` obtained from the native Google Sign-In SDK. This endpoint handles both sign-up and sign-in seamlessly.
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI..."
}
// Returns: { "data": { "accessToken": "eyJhbG..." } }
```

### Verify Transaction PIN
**`POST /api/v1/auth/verify-transaction-pin`**
Use this to confirm the user remembers their PIN before taking them to the payout trigger screen.
```json
{
  "pin": "1234"
}
```

---

## 2. User Profile & Bank Settings

### Get My Profile
**`GET /api/v1/users/me`**
Returns the user's profile. **Mobile Hint:** If `payoutBankCode` is `null`, force the user to set up their bank account before they can join/create groups.
```json
// Response:
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "08012345678",
    "payoutBankCode": null,
    "payoutAccountNumber": null,
    "payoutAccountName": null,
    "isDeactivated": false
  }
}
```

### Update My Profile
**`PATCH /api/v1/users/me`**
Update basic profile information.
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "08012345678"
}
```

### Change Password
**`PATCH /api/v1/auth/password`**
```json
{
  "currentPassword": "oldPassword123!",
  "newPassword": "newSecurePassword456!"
}
```

### Initiate Account Deletion
**`POST /api/v1/users/me/delete/initiate`**
Generates a 6-digit OTP and returns it (for this hackathon) to verify the soft deletion.
```json
{
  "reason": "I want to delete my account."
}
// Returns: { "data": { "otp": "123456" } }
```

### Verify Account Deletion
**`POST /api/v1/users/me/delete/verify`**
Verifies the OTP and schedules the account for soft deletion (14-day retention). User's JWT is immediately invalidated for all standard endpoints.
```json
{
  "otp": "123456"
}
```

### Reactivate Account
**`POST /api/v1/users/me/reactivate`**
Restores full access to a deactivated account. Requires a valid JWT (user must log in first).
```json
// No body required
```

### Get Supported Banks
**`GET /api/v1/users/banks`**
Returns a list of supported Nigerian banks for the dropdown menu.
```json
// Response:
{
  "data": [
    { "bankCode": "044", "bankName": "Access Bank" },
    { "bankCode": "058", "bankName": "Guaranty Trust Bank" }
  ]
}
```

### Resolve Account Number
**`POST /api/v1/users/resolve-account`**
Use this to auto-fill the user's name when they type in their account number.
```json
{
  "bankCode": "058",
  "accountNumber": "0123456789"
}
// Returns: { "data": { "accountName": "JOHN DOE" } }
```

### Update Payout Bank Settings
**`PATCH /api/v1/users/payout-settings`**
Save the user's verified bank details where they will receive their Ajo payouts.
```json
{
  "payoutBankCode": "058",
  "payoutAccountNumber": "0123456789",
  "payoutAccountName": "JOHN DOE"
}
```

---

## 3. Savings Groups

### Create a Group
**`POST /api/v1/groups`**
Note: `contributionAmount` is sent in raw Naira (e.g. 50000 = ₦50,000). The backend handles Kobo conversion safely.
```json
{
  "name": "Lagos Traders Ajo",
  "description": "Weekly contribution for our cohort.",
  "frequency": "WEEKLY", // "DAILY", "WEEKLY", "MONTHLY"
  "contributionAmount": 50000,
  "numberOfParticipants": 10
}
// Returns: { "data": { "id": "uuid", "inviteCode": "AJO-7B9A2F" } }
```

### Join a Group
**`POST /api/v1/groups/join`**
```json
{
  "inviteCode": "AJO-7B9A2F"
}
// Returns: { "data": { "groupId": "...", "membershipId": "..." } }
```

### Get User's Groups
**`GET /api/v1/groups`**
Fetches all savings groups the user belongs to, including limited details about the active cycle and their payment status.
```json
// Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "Backend Engineers Ajo",
      "inviteCode": "XYZ123",
      "frequency": "WEEKLY",
      "contributionAmount": 5000000,
      "expectedGrossContributionAmount": 5025000,
      "joinedCount": 5,
      "numberOfParticipants": 10,
      "cycleDetails": {
        "currentCycle": 1,
        "contributionAmount": 5000000,
        "potCollected": 10000000,
        "potTarget": 50000000,
        "nextPayoutDate": "2024-04-10T12:00:00Z"
      },
      "myDetails": {
        "position": 2,
        "status": "PENDING"
      }
    }
  ]
}
```

### Get Group Details
**`GET /api/v1/groups/:id`**
Fetches full group details, the active cycle, and the user's dedicated Nomba virtual account for transferring their contribution.
```json
// Response:
{
  "data": {
    "id": "uuid",
    "name": "Backend Engineers Ajo",
    "inviteCode": "XYZ123",
    "frequency": "WEEKLY",
    "contributionAmount": 5000000,
    "expectedGrossContributionAmount": 5025000,
    "joinedCount": 5,
    "numberOfParticipants": 5,
    "groupProgress": {
      "paid": 1,
      "pending": 4,
      "total": 5
    },
    "activeCycle": {
      "id": "uuid",
      "contributionAmountKobo": 5000000,
      "grossContributionAmount": 5025000,
      "currentRound": 1,
      "myContributionStatus": "PENDING"
    },
    "members": [
      {
        "membershipId": "uuid-member1",
        "firstName": "Adam",
        "lastName": "Abdulkareem",
        "email": "coordinator@example.com",
        "role": "COORDINATOR",
        "payoutTurn": 1,
        "virtualAccountNumber": "7484029489", // Null if viewer is not admin/self
        "virtualBankName": "Nombank MFB", // Null if viewer is not admin/self
        "virtualAccountName": "Nomba/Ajo Ledger", // Null if viewer is not admin/self
        "contributionStatus": "PAID" // Null if viewer is not admin/self
      },
      {
        "membershipId": "uuid-member2",
        "firstName": "Okikiola",
        "lastName": "Kazeem",
        "email": "member2@example.com",
        "role": "CONTRIBUTOR",
        "payoutTurn": 2,
        "virtualAccountNumber": null, // Masked for privacy
        "virtualBankName": null, // Masked for privacy
        "virtualAccountName": null, // Masked for privacy
        "contributionStatus": null // Masked for privacy
      }
    ]
  }
}
```

### Assign Payout Order
**`PATCH /api/v1/groups/:id/payout-order`**
Only the Coordinator can use this. Drag-and-drop on mobile, then send the final array here.
```json
{
  "assignments": [
    { "membershipId": "uuid-1", "payoutTurn": 1 },
    { "membershipId": "uuid-2", "payoutTurn": 2 }
  ]
}
```

---

## 4. Savings Cycles & Payouts

### Start Savings Cycle
**`POST /api/v1/groups/:id/cycles`**
Only the Coordinator can trigger this. The payload is empty. The backend calculates the rules dynamically.
```json
{}
// Returns: { "data": { "id": "cycle-uuid", "currentRound": 1, ... } }
```

### Disburse Payout (End of Round)
**`POST /api/v1/groups/:id/cycles/:cycleId/disburse`**
Only the Coordinator can trigger this. Sends the pot to the winner's configured bank account and progresses the cycle to the next round.
```json
{
  "transactionPin": "1234"
}
// Returns: { "data": { "nombaStatus": "SUCCESS" } }
```

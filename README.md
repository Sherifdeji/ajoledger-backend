# AjoLedger Backend 🚀

A trustless, automated community finance and escrow engine (Ajo/Esusu) built for the **Nomba Hackathon 2026**.

AjoLedger eliminates the manual administration, trust issues, and operational friction of traditional savings groups by leveraging Nomba's enterprise banking APIs to automatically track contributions, secure funds, and disburse payouts.

## 🏗 Architecture & Core Features

- **Progressive Profiling:** Users can join groups instantly. Sensitive KYC operations (like Bank Account setup and 4-digit Transaction PINs) are only required when the user is ready to withdraw funds.
- **Dedicated Virtual Accounts:** Powered by Nomba. Every user gets a unique, static Virtual Account assigned to them specifically for each savings group they join.
- **Automated Ledger:** The backend securely listens to Nomba Webhooks (with HMAC-SHA256 cryptographic signature verification) to instantly reconcile inflows and update user contribution statuses without manual intervention.
- **Trustless Disbursements:** At the end of a cycle, the group coordinator initiates the NIBSS outbound payout using their secure Transaction PIN. The backend deducts Nomba network fees and automatically routes the pot to the winner's verified local bank account via Nomba's `v2/transfers/bank` API.
- **Financial Integrity:** All monetary values are strictly calculated and stored in **Kobo** (integers) to prevent floating-point precision errors.

## 🔗 Nomba API Integrations

This project heavily utilizes the following Nomba endpoints:
- `POST /v1/auth/token/issue` - Secure Bearer Token generation with proactive in-memory caching.
- `POST /v1/accounts/virtual/{subAccountId}` - Dynamic Dedicated Virtual Account generation.
- `GET /v1/transfers/banks` - Nigerian Bank listing for KYC setup.
- `POST /v1/transfers/bank/lookup` - Bank Account Name resolution and verification.
- `POST /v2/transfers/bank/{subAccountId}` - Idempotent outbound payouts to beneficiaries.
- **Webhooks** (`payment_success` & `payout_success`) - Real-time event notifications.

## 🛠 Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (TypeScript)
- **Database:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Validation:** `class-validator` & `class-transformer`
- **Hosting:** Render

## 💻 Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sherifdeji/ajoledger-backend.git
   cd ajoledger-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Copy the `.env.example` file to `.env` and fill in your Nomba API credentials and Postgres connection string.
   ```bash
   cp .env.example .env
   ```

4. **Database Migrations:**
   ```bash
   npx prisma migrate dev
   ```

5. **Run the server:**
   ```bash
   npm run start:dev
   ```

## 🔒 Security Posture
- Global JWT Authentication for all protected endpoints.
- bcrypt hashing for passwords and transaction PINs.
- Strict Nomba `nomba-signature` HMAC-SHA256 validation via custom NestJS Guards.
- Prisma `$transaction` blocks to prevent race conditions during payout disbursements.
- Idempotency keys (`X-Idempotent-key`) used on all financial outbound calls.

---
*Built with ❤️ by The Avengers for the Nomba Hackathon 2026.*

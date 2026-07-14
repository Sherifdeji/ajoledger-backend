# AjoLedger Backend

A trustless, automated community finance and escrow engine (Ajo/Esusu) built for the [**Nomba X Dev Career Hackathon 2026**](https://devcareer.io/programs/nomba-hackathon).

AjoLedger eliminates the manual administration, trust issues, and operational friction of traditional savings groups by leveraging Nomba's enterprise banking APIs to automatically track contributions, secure funds, and disburse payouts.

---

## 👨‍⚖️ Important: Reviewer Guide

Welcome, Hackathon Judges and Reviewers! To save you time evaluating our project, we have pre-configured two test accounts for you.

**📲 Download the Mobile App (APK):** [https://drive.google.com/drive/folders/12GXXVyOGmaRj0ZdgauH5xFnQaifSoMLh?usp=sharing](https://drive.google.com/drive/folders/12GXXVyOGmaRj0ZdgauH5xFnQaifSoMLh?usp=sharing)

### 🧪 Step-by-Step Testing Guide

1. **Log in as the Coordinator**
   - **Email:** `coordinator@ajoledger.com`
   - **Password:** `Nomba2026!`
   - *(Note: After logging in, the app will ask you to set a local 6-digit passcode. You can use any 6 numbers, e.g., `123456`)*
2. **Setup Payout Bank Details:** Before you can receive or initiate any payouts, go to the **Profile tab -> Bank Details** and set up your local bank account. 
3. **Create a Group:** Navigate to the "Groups" tab and create a new savings group. Take note of the invite code.
4. **Switch Accounts:** Log out of the Coordinator account (or open the app on a second device).
5. **Log in as the Contributor**
   - **Email:** `contributor@ajoledger.com`
   - **Password:** `Nomba2026!`
6. **Setup Payout Bank Details:** Go to the **Profile tab -> Bank Details** and set up the contributor's local bank account.
7. **Join the Group:** Use the invite code generated in Step 3 to join the group.
8. **Test the Workflow:** You can now test Nomba's virtual account generation, make contributions, and initiate payouts! 
   - **Transaction PIN:** Whenever the app asks for a 4-digit PIN to authorize a payout, use **`1234`**.

---

## 🏗 Architecture & Core Features

- **Dedicated Virtual Accounts:** Powered by Nomba. Every user gets a unique, static Virtual Account assigned to them specifically for each savings group they join.
- **Automated Ledger:** The backend securely listens to Nomba Webhooks (with HMAC-SHA256 cryptographic signature verification) to instantly reconcile inflows and update user contribution statuses without manual intervention.
- **Trustless Disbursements:** At the end of a cycle, the group coordinator initiates the NIBSS outbound payout using their secure Transaction PIN. The backend deducts Nomba network fees and automatically routes the pot to the winner's verified local bank account via Nomba's `v2/transfers/bank` API.
- **Financial Integrity:** All monetary values are strictly calculated and stored in **Kobo** (integers) to prevent floating-point precision errors.

## 📚 API Documentation

Interactive API documentation is generated automatically using Swagger UI.
- **Live Docs:** [https://ajoledger-backend.onrender.com/api/docs](https://ajoledger-backend.onrender.com/api/docs)

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
- `bcrypt` hashing for passwords and transaction PINs.
- Strict Nomba `nomba-signature` HMAC-SHA256 validation via custom NestJS Guards.
- Prisma `$transaction` blocks to prevent race conditions during payout disbursements.
- Idempotency keys (`X-Idempotent-key`) used on all financial outbound calls.

---
*Built with ❤️ by The Avengers for the Nomba Hackathon 2026.*

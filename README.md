# ReturnDesk — Support Agent Returns & Refunds Desk

[![Live Production URL](https://img.shields.io/badge/Live%20URL-return--desk--seven.vercel.app-blue?style=for-the-badge&logo=vercel)](https://return-desk-seven.vercel.app)
[![Tech Stack](https://img.shields.io/badge/Next.js%2014-App%20Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-00e599?style=for-the-badge&logo=postgresql)](https://neon.tech/)
[![ORM](https://img.shields.io/badge/Prisma-5.14.0-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)

ReturnDesk is a production-grade return management desk built for small e-commerce stores. When customers want to return or replace items, support agents manage the lifecycle: reviewing, approving (with refunds, replacements, or store credit), rejecting, adding chronological audit notes, and taking requests off the desk.

**Live Application URL:** [https://return-desk-seven.vercel.app](https://return-desk-seven.vercel.app)  
**Repository:** [https://github.com/RachitSrivas/ReturnDesk](https://github.com/RachitSrivas/ReturnDesk)

---

## 🛠 Technology Stack

* **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS.
* **Backend:** Next.js Route Handlers (Node.js runtime).
* **Database:** PostgreSQL on Neon Serverless.
* **ORM & Migrations:** Prisma Client v5.14 with declarative SQL migrations.
* **Validation:** Zod v3.23 for strict request body parsing and error shaping.
* **Language:** TypeScript 5.5 in strict mode.

---

## 🏛 Business Rules & Server Enforcement

The core business logic is strictly enforced in the service layer (`src/services/return-service.ts`) and at the database constraint level. Client UI reflects these rules, but the server never trusts the client:

### 1. Strict Status Lifecycle Flow
A return request follows a deterministic finite-state transition matrix:
```
           ┌─> APPROVED ───> COMPLETED
           │
OPEN ────> IN_REVIEW
           │
           └─> REJECTED
```
* Legal transitions:
  * `OPEN` → `IN_REVIEW`
  * `IN_REVIEW` → `APPROVED` or `REJECTED`
  * `APPROVED` → `COMPLETED`
* `REJECTED` and `COMPLETED` are final terminal states. Any attempt to transition backwards or skip states (e.g., `OPEN` straight to `COMPLETED`) is refused with `409 Conflict`.

### 2. Approval Resolution Rules
* A request **cannot** transition to `APPROVED` without selecting a valid resolution: `REFUND`, `REPLACEMENT`, or `STORE_CREDIT`.
* If resolution is `REFUND`, a `refundAmount > 0` is strictly required (`422 Unprocessable Entity`).
* If resolution is not `REFUND`, recording a refund amount is prohibited (`422 Unprocessable Entity`).

### 3. One Live Request Per Item (Database + Service Level)
* A customer cannot have two live requests for the same item on the same order.
* A request is "live" if its status has not yet reached `REJECTED` or `COMPLETED`.
* Enforced via a **PostgreSQL partial unique index** in migration:
  ```sql
  CREATE UNIQUE INDEX unique_live_order_item 
  ON "ReturnRequest"("orderNumber", "itemSku") 
  WHERE "status" NOT IN ('REJECTED', 'COMPLETED') AND "removedAt" IS NULL;
  ```
  Attempting to create a duplicate live request is rejected with `409 Conflict`. Once the earlier request is closed or rejected, a new request can be created.

### 4. Locked Once Decided
* Once a request reaches `APPROVED`, `REJECTED`, or `COMPLETED`, customer and item details (name, email, order, SKU, quantity, reason) are permanently locked against edits (`409 Conflict`).
* Audit notes can still be appended at any stage in the lifecycle.

### 5. Safe Removal (Soft Delete)
* Requests removed from the desk are never hard-deleted; their `removedAt` timestamp is set so historical audit trails persist.
* Only requests in `OPEN` or `REJECTED` states may be removed. Attempting to remove an `IN_REVIEW`, `APPROVED`, or `COMPLETED` request is refused with `409 Conflict`.

---

## 🌐 API Design & Endpoints

All responses follow predictable JSON shapes and honest HTTP semantics:

| Method | Endpoint | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/returns` | List requests with search, filter, sort, and pagination | `200` |
| `POST` | `/api/returns` | Create a new request (auto-generates `RET-...` reference) | `201`, `409`, `422` |
| `GET` | `/api/returns/[id]` | Fetch single request with ordered audit notes | `200`, `404` |
| `PATCH` | `/api/returns/[id]` | Edit details (only when `OPEN` or `IN_REVIEW`) | `200`, `404`, `409`, `422` |
| `PATCH` | `/api/returns/[id]/status` | Move lifecycle status with resolution validation | `200`, `404`, `409`, `422` |
| `POST` | `/api/returns/[id]/notes` | Append a non-deletable audit note | `201`, `404`, `422` |
| `DELETE` | `/api/returns/[id]` | Soft-delete request (only `OPEN` or `REJECTED`) | `204`, `404`, `409` |

### Standard Error Response Shape
```json
{
  "error": {
    "code": "ApiError",
    "message": "Only OPEN or IN_REVIEW requests can be edited.",
    "details": null
  }
}
```

---

## 💻 Frontend Features

* **Live Stat Counters:** Displays counts for Active Desk, Open/Pending, In Review, Approved, and Rejected requests. Clicking any card quickly filters by that status.
* **Server-Side Debounced Search:** 350ms client-side debouncing prevents hammering the server on every keystroke.
* **Server-Side Filters & Sorting:** Status, Reason, and Sort dropdowns pass params directly to PostgreSQL queries.
* **Interactive Modals:**
  * **Raise Request Modal:** Validated inputs; automatically receives server-generated human-readable reference.
  * **Work Desk Drawer:** Shows chronological audit notes, add-note input, item details, and legal-only state transition buttons.
  * **Approval Resolution Dialog:** Dynamically requests refund amount when selecting `REFUND`.
* **Zero Swallowed Errors:** All server refusal codes (`409`, `422`, `404`) surface clean, actionable feedback banners.
* **Fully Responsive:** Usable across mobile screens down to 375px.

---

## 🚀 Setup Steps from Clean Machine

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/RachitSrivas/ReturnDesk.git
cd ReturnDesk
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and insert your PostgreSQL connection string:
```bash
cp .env.example .env
```
Inside `.env`:
```env
DATABASE_URL="postgresql://neondb_owner:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
```

### 3. Run Database Migrations
```bash
npx prisma migrate deploy
```

### 4. Run the Seed Script
Populates the database with 30 realistic requests across all statuses, reasons, and audit notes:
```bash
npm run seed
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⏱ Time Spent & Key Design Decisions

* **Estimated Time Spent:** ~6.5 hours total (Data modeling & partial unique index: 1.5h, Service layer & business rules: 2h, Frontend Portal UI & debouncing: 2h, Testing, deployment & documentation: 1h).
* **Key Decisions:**
  * **PostgreSQL Partial Unique Index over Application Locks:** Enforcing one live request per item directly inside PostgreSQL guarantees zero race conditions even under concurrent requests.
  * **Prisma Scripts on Vercel:** Kept `postinstall: "prisma generate"` so dependency installation remains fast and offline, and moved `prisma migrate deploy` into the `build` script to guarantee all environment variables and outbound tunnels are ready.

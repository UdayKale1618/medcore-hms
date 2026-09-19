# MedCore HMS — Hospital Management Platform

MedCore HMS is a full-stack, cloud-native Hospital Management Platform designed to digitise end-to-end clinical and administrative workflows across hospital branches with robust row-level multi-tenancy and role-based access control (RBAC).

---

## Architecture Overview

* **Monorepo Architecture**:
  * `apps/backend`: Enterprise NestJS 12 API with TypeScript.
  * `apps/frontend`: Next.js 15 App Router frontend.
  * `packages/types`: Shared TypeScript interfaces and contracts.
* **Database & ORM**: PostgreSQL 16 managed via Prisma 7 using the `@prisma/adapter-pg` driver adapter.
* **Cache & Session Store**: Redis 7 for refresh token rotation, device session management, and caching.
* **Security**: JWT Access Tokens (15m TTL), Refresh Tokens (7d TTL, httpOnly cookies), bcrypt password hashing (cost factor 12).
* **Multi-Tenancy**: Row-level tenancy enforced via `hospitalId`. Regular hospital staff and admins are strictly scoped to their hospital tenant; `SUPER_ADMIN` possesses cross-tenant access.

---

## Week 1 Scope & Implemented Modules

### 1. Authentication & Sessions (`/auth`)
* `POST /auth/register` — Register user with hospital and role association
* `POST /auth/login` — Authenticate user, issue JWT access token & rotate refresh token in Redis
* `POST /auth/refresh` — Exchange refresh token for new access token with rotation
* `POST /auth/logout` — Revoke active session in Redis and clear cookies
* `POST /auth/forgot-password` — Generate password reset token
* `POST /auth/reset-password` — Validate reset token and update password hash
* `POST /auth/send-verification-otp` — Generate 6-digit email verification OTP
* `POST /auth/verify-otp` — Validate OTP and confirm email verification
* `GET /auth/me` — Retrieve authenticated user profile from token context

### 2. Hospital Management (`/hospitals`)
* `GET /hospitals/me` — Retrieve authenticated user's hospital details
* `PATCH /hospitals/me` — Update authenticated user's hospital & address (`HOSPITAL_ADMIN`, `SUPER_ADMIN`)
* `GET /hospitals` — List all hospitals platform-wide (`SUPER_ADMIN`)
* `POST /hospitals` — Onboard new hospital with nested address (`SUPER_ADMIN`)
* `GET /hospitals/:id` — Retrieve hospital by ID with tenant isolation
* `PATCH /hospitals/:id` — Update hospital by ID with tenant isolation (`HOSPITAL_ADMIN`, `SUPER_ADMIN`)
* `GET /hospitals/:id/departments` — List departments for specified hospital

### 3. Department Management (`/departments`)
* `POST /departments` — Create department with service-level duplicate name check (`HOSPITAL_ADMIN`, `SUPER_ADMIN`)
* `GET /departments` — List departments scoped to caller's hospital
* `GET /departments/:id` — Retrieve department details with tenant isolation
* `PATCH /departments/:id` — Update department details with conflict checks
* `DELETE /departments/:id` — Delete department with safety check for active doctors

### 4. Doctor Management (`/doctors`)
* `POST /doctors` — Create doctor profile linked to `User` and `Department` with license number validation (`HOSPITAL_ADMIN`, `SUPER_ADMIN`)
* `GET /doctors` — List doctors with query filters (`hospitalId`, `departmentId`, `specialization`) excluding soft-deleted records (`deletedAt: null`)
* `GET /doctors/:id` — Retrieve doctor details with nested department, user, and availability schedules
* `PATCH /doctors/:id` — Update doctor profile (`HOSPITAL_ADMIN`, `SUPER_ADMIN`, or Doctor owner)
* `DELETE /doctors/:id` — Deactivate / soft-delete doctor profile

### 5. Doctor Availability (`/doctors/:doctorId/availability`, `/availability`)
* `POST /doctors/:doctorId/availability` — Create weekly availability schedule slot (day 0–6, `HH:mm` format, overlap detection)
* `GET /doctors/:doctorId/availability` — List schedule slots for doctor sorted chronologically
* `GET /availability/:id` — Retrieve specific availability slot
* `PATCH /availability/:id` — Update availability slot with conflict validation
* `DELETE /availability/:id` — Delete availability schedule slot

---

## Roles & Permissions (RBAC)

The system enforces granular RBAC for all 9 platform roles:
1. `SUPER_ADMIN`: Cross-tenant platform management and hospital onboarding.
2. `HOSPITAL_ADMIN`: Hospital configuration, staff management, departments, and doctor schedules.
3. `DOCTOR`: Profile management and own availability calendar.
4. `NURSE`: Clinical access to hospital staff and departments.
5. `RECEPTIONIST`: Patient and appointment scheduling access.
6. `LAB_TECHNICIAN`: Laboratory test processing.
7. `PHARMACIST`: Pharmacy and prescription management.
8. `ACCOUNTANT`: Billing and invoice access.
9. `PATIENT`: Patient self-service, record viewing, and appointment discovery.

---

## Local Development Setup

### 1. Prerequisites
* Node.js 20+ LTS
* Docker & Docker Desktop

### 2. Infrastructure (PostgreSQL & Redis)
Start the PostgreSQL and Redis containers using Docker Compose:
```bash
docker compose up -d
```

### 3. Backend Environment Configuration
Copy the sample environment configuration file:
```bash
cp .env.example apps/backend/.env
```

### 4. Database Migrations & Seeding
```bash
cd apps/backend
npx prisma migrate dev
npx prisma db seed
```

### 5. Running the Backend Server
```bash
npm run start:dev
```
The API server starts on `http://localhost:5000`.

---

## Running Automated Tests & Build

```bash
cd apps/backend

# Run complete test suite (Unit & Integration tests)
npm run test

# Run build verification
npm run build
```
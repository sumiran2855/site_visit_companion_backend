# Site Visit Companion — Backend

Backend REST API for the **EC Power Site Visit Companion** field technician application. Built with **Node.js**, **TypeScript**, and **Fastify**, adhering to a **Repository-Service-Controller** layered pattern with strict **Object-Oriented Programming (OOP)**.

---

## Tech Stack

- **Runtime & Framework**: Node.js (>=20), Fastify v5
- **Language**: TypeScript (ESM, strict mode)
- **Database & Auth**: Supabase (PostgreSQL + Supabase Auth)
- **Object Storage**: Cloudflare R2 (S3-compatible via `@aws-sdk/client-s3`)
- **PDF Generation**: Playwright (Headless Chromium)
- **ZIP Packaging**: Archiver v8
- **Validation**: Zod
- **Documentation**: Swagger / OpenAPI (`@fastify/swagger-ui`)

---

## Features

- **Authentication & Approval Flow**: Role-based access control (`standard`, `company_admin`, `super_admin`) with admin approval workflow for new accounts.
- **Multi-Tenant Company Hierarchy**: Supports parent and sub-companies with data isolation.
- **Site Visit Management**: Scoped by company and role, with real-time completion tracking.
- **Checklist Engine**: Collapsible sections, text answers, photo/video fields, notes, and auto-save.
- **Media Management**: Short-lived presigned upload and download URLs via Cloudflare R2.
- **Strict Media Association**: Fixes prototype image mismatch bugs by explicitly linking `Visit -> Section -> Field -> Media`.
- **Export Services**:
  - Download Project Folder as ZIP (`<Site_name>_<YYYY-MM-DD>.zip`) with root folder structure.
  - Download Print-Friendly PDF (blank ruled lines for offline field completion).
  - Download Completed PDF Report with exact embedded photos.
- **PDF Template Management**: Dynamic customizable PDF templates for report generation.
- **Data Retention & Purge**: Scheduled 1-year data retention cleanup and account purge across DB, Auth, and Storage.

---

## Getting Started

### 1. Prerequisites

- Node.js >= 20 (Node 22 recommended)
- Supabase account & project

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_ENDPOINT=
```

### 3. Installation

```bash
npm install
```

### 4. Running the Development Server

```bash
npm run dev
```

The server will start at:
- API Base: `http://localhost:4000`
- Interactive Swagger UI: `http://localhost:4000/docs`
- Health Check: `http://localhost:4000/health`

### 5. Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```text
src/
├── config/             # Environment validation and constants
├── types/              # Domain models and role interfaces
├── errors/             # Custom domain error classes (400, 401, 403, 404, 409)
├── utils/              # Structured Logger, DateUtil, ResponseFormatter
├── validators/         # Zod schemas for request validation
├── models/             # Domain entity classes (OOP)
├── database/           # Supabase client provider
├── repositories/       # Data access layer (Interfaces & Supabase implementations)
├── services/           # Business logic layer
├── middlewares/        # Authentication, RBAC, and company isolation hooks
├── controllers/        # HTTP request handlers
├── routes/             # Fastify route definitions
├── app.ts              # Fastify application builder
└── server.ts           # Server bootstrap & graceful shutdown
```

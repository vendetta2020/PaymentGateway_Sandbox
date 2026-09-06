# Educational Payment Gateway

An educational payment gateway project built with NestJS, PostgreSQL, and TypeORM. Inspired by real-world processors like Midtrans, Xendit, and Stripe.

> **Disclaimer**: This is strictly an educational system. It is NOT a real payment processor, does NOT process real financial transactions, and does NOT claim PCI DSS compliance.

## 🚀 Features

- **Merchant Management**: Multi-merchant isolation and provisioning.
- **API Authentication**: Secure API key generation (Live/Test modes) with prefix-based and hashed storage.
- **Payment Lifecycle**: Robust state machine (`PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `EXPIRED`).
- **Simulated Providers**: Deterministic external provider simulator (Bank Transfer, E-Wallet, Card, QRIS).
- **Idempotency**: Strict idempotency controls using `Idempotency-Key` headers to prevent double charges.
- **Webhooks**: Merchant notification system with event delivery, retries, and HMAC payload signing.
- **Refunds**: Full and partial refunds validation, pessimistic locking, and lifecycle tracking.
- **Settlements**: Deterministic financial settlement calculation with cross-period debt resolution.
- **Reconciliation**: Two-way reconciliation engine comparing internal records with simulated bank mutations.
- **Dockerized**: Full production-ready Docker Compose environment.

## 🛠 Tech Stack

- **Framework**: NestJS (v10) / Node.js (v24)
- **Database**: PostgreSQL 16
- **ORM**: TypeORM
- **Testing**: Jest (Unit & E2E)
- **Docs**: OpenAPI (Swagger)
- **Infrastructure**: Docker & Docker Compose

## 📦 Local Development Setup

### 1. Prerequisites
- Docker & Docker Compose installed.
- Node.js v24 (optional, for local development outside Docker).

### 2. Start Services
To start the database and backend application:
```bash
docker compose up -d --build
```
This will start:
- PostgreSQL on port `5432`
- NestJS API on port `3000`

### 3. Verify Health
```bash
curl http://localhost:3000/health
```

### 4. API Documentation
Access the interactive Swagger documentation at:
http://localhost:3000/docs

## 🧪 Testing

The repository includes a comprehensive test suite (Unit & E2E) ensuring strict financial integrity and concurrency safety.

```bash
cd backend
npm install
# Run unit tests
npm run test
# Run end-to-end tests (requires PostgreSQL)
npm run test:e2e
```

## 🏗 Architecture & Design Decisions

1. **Modular Monolith**: Domains (Merchants, Payments, Refunds, Settlements, Webhooks) are strictly separated into NestJS modules.
2. **Financial Precision**: All monetary values are stored as integers (`BIGINT`) representing the smallest currency unit. Floating point math is strictly forbidden in calculations.
3. **Database Transactions**: Domain operations employ explicit TypeORM query runners to guarantee ACID compliance.
4. **Non-Mutation Invariant**: The reconciliation engine acts as an append-only auditor and never alters internal payment records.
5. **Concurrency Control**: Unique constraints (`merchant_id`, `idempotency_key`) and pessimistic locking (`FOR UPDATE`) are heavily utilized to serialize simultaneous requests and prevent race conditions.

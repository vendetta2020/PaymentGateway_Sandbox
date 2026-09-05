# Payment Gateway

> **Educational / Portfolio Project**
>
> This is a technically serious payment gateway simulation built for learning and demonstration purposes.
> It is NOT a real payment processor and is NOT PCI DSS compliant.

## Tech Stack (Phase 1)

- **Backend**: Node.js, TypeScript, NestJS
- **Database**: PostgreSQL 16
- **Testing**: Jest, Supertest
- **Infrastructure**: Docker, Docker Compose

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- npm

## Getting Started

### 1. Start infrastructure services

```bash
docker compose up -d
```

This starts PostgreSQL 16 with health checks and automatically creates development and test databases.

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
npm install
```

### 3. Run database migrations

```bash
npm run migration:run
```

### 4. Run the application

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/`.

### 5. Verify health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    }
  }
}
```

## Testing

```bash
# Unit tests
npm test

# E2E tests (requires PostgreSQL container running)
npm run test:e2e

# Linting
npm run lint

# Production build
npm run build
```

## Project Structure

```
PaymentGateway/
├── backend/                  # NestJS Application
│   ├── Dockerfile            # Multi-stage production build
│   ├── src/
│   │   ├── common/           # Shared filters and utilities
│   │   ├── config/           # Joi environment validation
│   │   ├── database/         # TypeORM module & CLI DataSource
│   │   └── health/           # Health check endpoint & unit tests
│   └── test/                 # E2E test suite
├── docker/
│   └── postgres/init/        # Database initialization scripts
├── docker-compose.yml        # PostgreSQL development container
├── .gitignore
└── README.md
```

## License

This project is for educational purposes.

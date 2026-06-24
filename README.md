# Board Exam Result Platform

A production-quality, microservices-based backend for managing board exam results with JWT authentication, RabbitMQ event-driven notifications, Redis caching, and Cloudinary media storage.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Folder Structure](#folder-structure)
3. [Tech Stack](#tech-stack)
4. [Quick Start (Docker)](#quick-start-docker)
5. [Local Development](#local-development)
6. [Environment Variables](#environment-variables)
7. [API Documentation](#api-documentation)
8. [Testing](#testing)
9. [Design Decisions](#design-decisions)
10. [Example Requests & Responses](#example-requests--responses)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client / API Consumer                  │
└──────────────┬────────────────────┬─────────────────────────┘
               │ :3001              │ :3002
   ┌───────────▼──────┐   ┌─────────▼──────────┐
   │   User Service   │   │   Result Service    │
   │  (PostgreSQL)    │   │  (PostgreSQL+Redis) │
   └───────────┬──────┘   └─────────┬──────────┘
               │ JWT verify (HTTP)   │ result.viewed event
               │◄────────────────────┤
               │                     │ RabbitMQ
               │            ┌────────▼───────────┐
               │            │  results.exchange   │
               │            │  (direct, durable)  │
               │            └────────┬────────────┘
               │                     │ result.viewed.queue
               │            ┌────────▼───────────┐
               │            │ Notification Service│
               │            │  (MongoDB)  :3003   │
               │            └────────────────────┘
               │
   ┌───────────▼──────────────────────────────────┐
   │              Infrastructure                    │
   │  PostgreSQL×2 │ MongoDB │ RabbitMQ │ Redis    │
   └──────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Port | Database | Key Responsibilities |
|---|---|---|---|
| **User Service** | 3001 | PostgreSQL | Registration, Login, JWT, Refresh Tokens, Cloudinary uploads, Internal user lookup |
| **Result Service** | 3002 | PostgreSQL | CRUD results, RBAC, Redis caching, RabbitMQ event publish |
| **Notification Service** | 3003 | MongoDB | Consume RabbitMQ events, send emails via Nodemailer, retry logic, email delivery logs |

### Authentication Flow

```
POST /api/v1/auth/login
  → User Service validates credentials
  → Returns accessToken (15m) + refreshToken (7d)

Protected Request
  → Bearer token in Authorization header
  → Service verifies JWT locally (shared secret)
  → Result Service also calls User Service /internal/users/:id
     with x-api-key header for user data
```

### Event Flow

```
Student calls GET /api/v1/results/me
  → Result Service fetches results from DB / Redis cache
  → Publishes to RabbitMQ: results.exchange → result.viewed routing key
  → Notification Service consumes message
  → Sends HTML email with results
  → Logs delivery status to MongoDB (SENT / FAILED)
  → On failure: retries 3× with exponential backoff
  → On exhausted retries: message → Dead Letter Queue (results.dlq)
```

---

## Folder Structure

```
board-exam-platform/
├── docker-compose.yml               # Full stack orchestration
├── README.md
├── .github/
│   └── workflows/
│       └── ci.yml                   # GitHub Actions CI pipeline
└── services/
    ├── user-service/                 # Port 3001
    │   ├── Dockerfile
    │   ├── nest-cli.json
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env / .env.example
    │   └── src/
    │       ├── main.ts
    │       ├── app.module.ts
    │       ├── auth/
    │       │   ├── auth.module.ts
    │       │   ├── auth.service.ts
    │       │   ├── auth.controller.ts
    │       │   ├── auth.service.spec.ts
    │       │   ├── strategies/jwt.strategy.ts
    │       │   ├── guards/jwt-auth.guard.ts
    │       │   ├── guards/internal-api-key.guard.ts
    │       │   └── decorators/
    │       │       ├── public.decorator.ts
    │       │       └── current-user.decorator.ts
    │       ├── users/
    │       │   ├── users.module.ts
    │       │   ├── users.service.ts
    │       │   ├── users.service.spec.ts
    │       │   ├── users.controller.ts
    │       │   ├── dto/user.dto.ts
    │       │   ├── entities/user.entity.ts
    │       │   └── repositories/users.repository.ts
    │       ├── common/
    │       │   ├── filters/http-exception.filter.ts
    │       │   ├── interceptors/logging.interceptor.ts
    │       │   └── logger/logger.factory.ts
    │       ├── config/
    │       │   ├── app.config.ts
    │       │   └── typeorm.config.ts
    │       └── migrations/
    │           └── 1700000000000-CreateUsersTable.ts
    │
    ├── result-service/               # Port 3002
    │   ├── Dockerfile
    │   ├── .env / .env.example
    │   └── src/
    │       ├── main.ts
    │       ├── app.module.ts
    │       ├── results/
    │       │   ├── results.module.ts
    │       │   ├── results.service.ts
    │       │   ├── results.service.spec.ts
    │       │   ├── results.controller.ts
    │       │   ├── user-lookup.service.ts
    │       │   ├── dto/result.dto.ts
    │       │   ├── entities/
    │       │   │   ├── result.entity.ts
    │       │   │   └── subject-marks.entity.ts
    │       │   └── repositories/results.repository.ts
    │       ├── rabbitmq/
    │       │   ├── rabbitmq.module.ts
    │       │   └── rabbitmq.producer.ts
    │       ├── common/
    │       │   ├── filters/http-exception.filter.ts
    │       │   ├── guards/jwt-auth.guard.ts
    │       │   ├── guards/roles.guard.ts
    │       │   ├── interceptors/logging.interceptor.ts
    │       │   └── decorators/
    │       │       ├── public.decorator.ts
    │       │       ├── roles.decorator.ts
    │       │       └── current-user.decorator.ts
    │       ├── config/typeorm.config.ts
    │       └── migrations/
    │           └── 1700000000001-CreateResultsTables.ts
    │
    └── notification-service/         # Port 3003
        ├── Dockerfile
        ├── .env / .env.example
        └── src/
            ├── main.ts
            ├── app.module.ts
            ├── notifications/
            │   ├── notifications.module.ts
            │   ├── notifications.service.ts
            │   ├── notifications.service.spec.ts
            │   ├── notifications.controller.ts
            │   ├── email.service.ts
            │   ├── email.service.spec.ts
            │   └── schemas/email-log.schema.ts
            ├── rabbitmq/
            │   ├── rabbitmq-consumer.module.ts
            │   └── rabbitmq.consumer.ts
            └── common/
                ├── filters/http-exception.filter.ts
                ├── guards/jwt-auth.guard.ts
                ├── guards/roles.guard.ts
                ├── interceptors/logging.interceptor.ts
                └── decorators/
                    ├── public.decorator.ts
                    └── roles.decorator.ts
```

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | NestJS 10 (TypeScript strict mode) |
| Auth | JWT (Passport), bcrypt, refresh tokens |
| Databases | PostgreSQL 15 (TypeORM, migrations), MongoDB 7 (Mongoose) |
| Messaging | RabbitMQ 3.12 (direct exchange, DLX/DLQ) |
| Caching | Redis 7 (in-memory fallback) |
| Email | Nodemailer (SMTP, retry + backoff) |
| Storage | Cloudinary (profile pictures) |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI |
| Testing | Jest + Supertest |
| Containerisation | Docker (multi-stage), Docker Compose |
| CI | GitHub Actions |

---

## Quick Start (Docker)

### Prerequisites

- Docker ≥ 24
- Docker Compose ≥ 2.20

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/board-exam-platform.git
cd board-exam-platform

# 2. Configure SMTP credentials for the notification service
#    (Optional — emails are logged even if SMTP is not configured)
nano services/notification-service/.env
# Set SMTP_HOST, SMTP_USER, SMTP_PASS

# 3. Configure Cloudinary for the user service (optional)
nano services/user-service/.env
# Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

# 4. Start everything
docker compose up --build

# Services will be available at:
#   User Service:         http://localhost:3001/api/docs
#   Result Service:       http://localhost:3002/api/docs
#   Notification Service: http://localhost:3003/api/docs
#   RabbitMQ Management:  http://localhost:15672  (rabbit_admin / rabbit_secret)
```

### Verify

```bash
# Health check (no auth required)
curl http://localhost:3003/api/v1/health

# User Service Swagger
open http://localhost:3001/api/docs
```

---

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL (two databases)
- MongoDB
- RabbitMQ
- Redis

### Per-service setup

```bash
# User Service
cd services/user-service
cp .env.example .env        # fill in your local values
npm install
npm run migration:run
npm run start:dev

# Result Service
cd services/result-service
cp .env.example .env
npm install
npm run migration:run
npm run start:dev

# Notification Service
cd services/notification-service
cp .env.example .env
npm install
npm run start:dev
```

---

## Environment Variables

### User Service

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | DB username | — |
| `DB_PASSWORD` | DB password | — |
| `DB_NAME` | DB name | — |
| `JWT_ACCESS_SECRET` | Access token signing key (≥32 chars) | — |
| `JWT_REFRESH_SECRET` | Refresh token signing key (≥32 chars) | — |
| `JWT_ACCESS_EXPIRY` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token TTL | `7d` |
| `INTERNAL_API_KEY` | Service-to-service auth key | — |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud | — |
| `CLOUDINARY_API_KEY` | Cloudinary API key | — |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | — |
| `THROTTLE_TTL` | Rate limit window (ms) | `60000` |
| `THROTTLE_LIMIT` | Max requests per window | `5` |

### Result Service

| Variable | Description |
|---|---|
| `PORT` | HTTP port (`3002`) |
| `DB_*` | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Must match User Service |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `REDIS_TTL` | Cache TTL in seconds |
| `USER_SERVICE_URL` | Base URL for internal user lookups |
| `INTERNAL_API_KEY` | Must match User Service |

### Notification Service

| Variable | Description |
|---|---|
| `PORT` | HTTP port (`3003`) |
| `MONGO_URI` | MongoDB connection string |
| `RABBITMQ_URL` | RabbitMQ connection URL |
| `SMTP_HOST/PORT/SECURE/USER/PASS` | Nodemailer SMTP credentials |
| `SMTP_FROM` | Sender address |
| `JWT_ACCESS_SECRET` | Must match User Service |
| `MAX_RETRIES` | Email retry count (default `3`) |
| `RETRY_BASE_DELAY_MS` | Backoff base delay (default `1000`) |

---

## API Documentation

Swagger UI is available at `/api/docs` on each service.

### User Service (`localhost:3001`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Register student or moderator |
| POST | `/api/v1/auth/login` | Public | Login, returns tokens |
| POST | `/api/v1/auth/refresh` | Public | Issue new access token |
| GET | `/api/v1/profile` | JWT | Get own profile |
| PUT | `/api/v1/profile` | JWT | Update own profile |
| POST | `/api/v1/profile/upload-image` | JWT | Upload profile picture |
| GET | `/api/v1/internal/users/:id` | x-api-key | Internal user lookup |

### Result Service (`localhost:3002`)

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/v1/results` | MODERATOR | Create result |
| PUT | `/api/v1/results/:id` | MODERATOR | Update result |
| DELETE | `/api/v1/results/:id` | MODERATOR | Delete result |
| GET | `/api/v1/results` | MODERATOR | List all results |
| GET | `/api/v1/results/me` | STUDENT | Own results (triggers notification) |
| GET | `/api/v1/results/:studentId` | MODERATOR | Results by student ID |

### Notification Service (`localhost:3003`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/health` | Public | Health check |
| GET | `/api/v1/logs/:studentId` | MODERATOR | Email delivery logs |

---

## Testing

### Unit Tests

```bash
# Run all unit tests for a service
cd services/user-service && npm test
cd services/result-service && npm test
cd services/notification-service && npm test

# With coverage
npm run test:cov
```

### E2E Tests

E2E tests require the full stack running (databases, RabbitMQ).

```bash
# Start dependencies only
docker compose up postgres-user-db postgres-result-db mongodb rabbitmq redis -d

# Run e2e tests
cd services/user-service && npm run test:e2e
cd services/result-service && npm run test:e2e
cd services/notification-service && npm run test:e2e
```

### Test Coverage Summary

Each service includes:

| Service | Unit Tests | E2E Tests |
|---|---|---|
| User Service | 5 (auth) + 5 (users) = **10** | **4** |
| Result Service | **6** | **4** |
| Notification Service | 5 (notifications) + 5 (email) = **10** | **3** |

---

## Design Decisions

### 1. Shared JWT Secret (Stateless Verification)
Rather than calling the User Service on every request in the Result and Notification services, they verify JWT tokens locally using the shared `JWT_ACCESS_SECRET`. The User Service is called only when user details (e.g., email, name) are needed for the RabbitMQ payload.

### 2. Non-blocking Event Publishing
Publishing to RabbitMQ after a student fetches results is wrapped in a try/catch and never causes the HTTP response to fail. Event delivery is best-effort from the Result Service perspective; the Notification Service owns retry semantics.

### 3. Dead Letter Queue
Failed messages that exhaust RabbitMQ consumer retries are routed to `results.dlx` → `results.dlq`. This prevents message loss and allows manual inspection or reprocessing.

### 4. TypeORM Migrations Only (`synchronize: false`)
Auto-synchronisation is disabled in all environments. All schema changes go through explicit migration files, preventing accidental data loss in production.

### 5. Repository Pattern
Each service wraps TypeORM/Mongoose operations in a dedicated repository class. This decouples business logic from the ORM and makes unit testing straightforward with simple mocks.

### 6. Global JWT Guard + `@Public()` Decorator
A global `JwtAuthGuard` protects all routes by default. Public routes (register, login, health) opt out using the `@Public()` decorator, which is a safer default-deny posture.

### 7. Internal API Key Guard
The `/internal/users/:id` endpoint is protected by an `x-api-key` header guard — separate from JWT — so it is never accidentally exposed to end users even if the JWT guard is bypassed.

### 8. Redis Caching in Result Service
Result reads are cached with a configurable TTL. Cache is invalidated on every write (create/update/delete) for the affected student. In-memory cache is used as fallback when Redis is unavailable.

### 9. Multi-stage Docker Builds
Production images contain only compiled JavaScript and production `node_modules`, keeping image sizes small and reducing attack surface. A non-root `nestjs` user runs the process.

### 10. Rate Limiting on Login
The `/auth/login` endpoint uses NestJS `@nestjs/throttler` to limit requests to 5 per 60 seconds per IP, mitigating brute-force attacks.

---

## Example Requests & Responses

### Register a Student

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecureP@ss1",
    "role": "STUDENT",
    "rollNumber": "ROLL2024001"
  }'
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "role": "STUDENT",
    "rollNumber": "ROLL2024001",
    "profilePicture": null,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com", "password": "SecureP@ss1"}'
```

### Create a Result (Moderator)

```bash
curl -X POST http://localhost:3002/api/v1/results \
  -H "Authorization: Bearer <moderator_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "550e8400-e29b-41d4-a716-446655440000",
    "examName": "12th Board Exam 2024",
    "academicYear": "2023-24",
    "totalMarks": 500,
    "percentage": 87.4,
    "subjectMarks": [
      { "subjectName": "Mathematics", "marks": 92 },
      { "subjectName": "Physics", "marks": 88 },
      { "subjectName": "Chemistry", "marks": 85 },
      { "subjectName": "English", "marks": 87 },
      { "subjectName": "Computer Science", "marks": 85 }
    ]
  }'
```

```json
{
  "id": "result-uuid-here",
  "studentId": "550e8400-e29b-41d4-a716-446655440000",
  "examName": "12th Board Exam 2024",
  "academicYear": "2023-24",
  "totalMarks": "500.00",
  "percentage": "87.40",
  "subjectMarks": [
    { "id": "sm-uuid-1", "subjectName": "Mathematics", "marks": "92.00", "resultId": "result-uuid-here" }
  ],
  "createdAt": "2024-01-15T10:05:00.000Z",
  "updatedAt": "2024-01-15T10:05:00.000Z"
}
```

### Student Fetches Own Results

```bash
curl http://localhost:3002/api/v1/results/me \
  -H "Authorization: Bearer <student_token>"
```

This triggers a `result.viewed` RabbitMQ event → Notification Service sends email.

### Check Email Delivery Logs (Moderator)

```bash
curl http://localhost:3003/api/v1/logs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <moderator_token>"
```

```json
[
  {
    "_id": "mongo-doc-id",
    "studentId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "jane@example.com",
    "status": "SENT",
    "message": "Result notification for 12th Board Exam 2024",
    "attempts": 1,
    "createdAt": "2024-01-15T10:05:03.000Z"
  }
]
```

### Standardised Error Response

```json
{
  "success": false,
  "message": "Invalid credentials",
  "error": "UnauthorizedException",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "path": "/api/v1/auth/login",
  "statusCode": 401
}
```

### Refresh Token

```bash
curl -X POST http://localhost:3001/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGciOiJIUzI1NiIs..."}'
```

---

## RabbitMQ Management

Access the management UI at `http://localhost:15672`

- Username: `rabbit_admin`
- Password: `rabbit_secret`

Key queues:
- `result.viewed.queue` — main notification queue
- `results.dlq` — dead letter queue for failed messages

---

## Cloudinary Setup (Optional)

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Copy your **Cloud Name**, **API Key**, and **API Secret** from the dashboard
3. Add them to `services/user-service/.env`

Profile pictures are uploaded to the `board-exam/profiles` folder and auto-cropped to 400×400 with face detection.

---

## SMTP Setup (Optional)

For testing without a real SMTP server, use [Ethereal Email](https://ethereal.email):

```bash
# Generate a test account
node -e "
const nodemailer = require('nodemailer');
nodemailer.createTestAccount().then(a => console.log(JSON.stringify(a, null, 2)));
"
```

Copy the `user`, `pass`, and SMTP settings into `services/notification-service/.env`.

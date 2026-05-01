# CA Practice Management System

Production-grade multi-tenant Practice Management System for Chartered Accountant firms in India.

## Current Scope

This repository is scaffolded for Phase 1:

- NestJS API with TypeScript strict mode
- MySQL 8 via TypeORM migrations
- JWT access and refresh token auth
- Password reset token flow
- Users, roles, permissions, teams, and team members
- RBAC guard and permission decorator
- Swagger docs at `/api/docs`
- Helmet, CORS, express rate limiting, request correlation IDs
- RFC 7807-style error responses

The Vite React dashboard workspace is reserved for later phases.

## Local Setup

```bash
cp .env.example .env
docker compose up -d mysql redis
npm install
npm run api:migration:run
npm run seed -w apps/api
npm run api:dev
```

API base URL: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/api/docs`

## Environment

Never hardcode database credentials. The API reads MySQL, Redis, JWT, CORS, rate limit, and storage settings from environment variables. Startup fails fast when required values are missing.

## Migrations

```bash
npm run api:migration:run
npm run api:migration:revert
```

TypeORM `synchronize` is disabled.

## Tests

```bash
npm run api:test
```

Phase 5 includes recurrence scheduler tests for due-date materialization and occurrence previews. Run the API test suite after installing dependencies.

## Workspaces

- API: `apps/api`
- Web dashboard: `apps/web`

Useful commands:

```bash
npm run api:dev
npm run api:build
npm run api:test
npm run dev -w apps/web
```

## Phase Coverage

- Phase 1: Auth, users, roles, permissions, teams, RBAC
- Phase 2: Customers, enquiries, onboarding conversion
- Phase 3: Services catalog, tasks, comments, attachments, time logs
- Phase 4: Workflow definitions and task step auto-advance
- Phase 5: Recurrences, scheduler, run logs, auto-assignment, statutory templates
- Phase 6: GST invoice records, line items, payments
- Phase 7: Dashboards and compliance calendar endpoints
- Phase 8: API keys, public integration endpoints, webhook definitions
- Phase 9: Notifications and audit log viewer
- Phase 10: React dashboard shell with dark mode and operational views

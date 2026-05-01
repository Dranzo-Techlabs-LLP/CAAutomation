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

Phase-specific integration tests will be added as each module is implemented.

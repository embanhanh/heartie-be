# Heartie API

Heartie API is a NestJS-based backend for an e-commerce experience featuring authentication, product catalog, promotions, and order management. It uses PostgreSQL via TypeORM, embraces strict DTO validation, and ships with auto-generated Swagger docs for quick exploration.

## Table of contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
  - [Modules](#modules)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment variables](#environment-variables)
  - [Install dependencies](#install-dependencies)
  - [Run locally](#run-locally)
  - [Run with Docker](#run-with-docker)
- [Available scripts](#available-scripts)
- [API reference](#api-reference)
- [Testing](#testing)
- [Coding conventions](#coding-conventions)
- [Troubleshooting](#troubleshooting)
- [Next steps](#next-steps)

## Overview

- **Framework**: NestJS 11 with Express adapter, TypeScript-first.
- **Database**: PostgreSQL 14+, accessed through TypeORM with entity-based configuration.
- **Authentication**: JWT access/refresh tokens, Passport strategies, bcrypt-secured credentials.
- **Docs**: Swagger UI exposed at `/api-docs` with bearer auth support.
- **Validation**: Global `ValidationPipe` enforces DTO schemas, strips unexpected fields, and auto-transforms payloads.
- **Static assets**: Files served from `/uploads` via Express static middleware.

## Tech stack

- Node.js ≥ 18 (tested with Yarn as package manager)
- NestJS, Passport, @nestjs/jwt
- TypeORM + PostgreSQL driver (`pg`)
- Class-validator & class-transformer
- Swagger decorators for OpenAPI
- Jest for unit/e2e testing, ESLint + Prettier for linting/formatting

## Architecture

The codebase follows NestJS modular design. Each domain lives in `src/modules/<feature>` with the classic controller ➜ service ➜ repository flow. TypeORM entities describe persistence, DTOs guard inputs, and services encapsulate business logic. Shared configuration (e.g., database credentials, JWT secrets) is resolved through the global `ConfigModule` reading from `.env`.

### Modules

| Module                      | Purpose                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `auth`                      | Registration, login, logout, refresh tokens using JWT (access + refresh strategies).            |
| `users`                     | User CRUD, password hashing, refresh token storage.                                             |
| `addresses`                 | Customer address book tied to users.                                                            |
| `products`                  | Product master data with rich JSON fields, category relations, pricing, stock metrics.          |
| `product_variants`          | Variant-level SKU details, pricing, inventory state, options.                                   |
| `categories`                | Hierarchical catalog with slug generation.                                                      |
| `customer_groups`           | Segments users into named cohorts for targeting campaigns and analytics.                        |
| `store_inventories`         | Per-store inventory records with validation against stores, variants, and users.                |
| `stores`                    | Physical/virtual store metadata.                                                                |
| `banners`                   | Marketing banners with schedule, CTA metadata, ordering.                                        |
| `interactions`              | User behavior tracking (view, like, add to cart, wishlist, etc.) with deduplication guardrails. |
| `ratings`                   | Product reviews with uniqueness and rating bounds enforced.                                     |
| `orders`                    | Order headers capturing totals, payment, delivery expectations, and address relation.           |
| `order_product_details`     | Junction table between orders and product variants with quantity tracking.                      |
| `vouchers`                  | Voucher setup, discount rules, product eligibility.                                             |
| `voucher_user_details`      | Voucher assignments to users with validity windows and usage tracking.                          |
| `user_customer_groups`      | Junction table mapping users to customer groups with assignment auditing.                       |
| `promotional_combos`        | Combo campaigns linking multiple products with validity and limits.                             |
| `promotional_combo_details` | Line-level combo details (quantity, discount per item).                                         |

Each module exports its controller/service pair and, when needed, registers repositories through `TypeOrmModule.forFeature([...])` inside the module definition.

## Project structure

```
src/
├── app.module.ts            # Root composition of modules & providers
├── main.ts                  # Bootstrap (ValidationPipe, Swagger, static assets)
└── modules/
		├── auth/
		│   ├── dto/
		│   ├── strategies/      # Access & refresh JWT strategies
		│   └── auth.*
		├── products/
		│   ├── dto/
		│   ├── entities/
		│   └── products.*
		├── ...                  # See module table above
dotenv, configs, scripts, and test harness live alongside the source tree.
```

Other noteworthy files:

- `package.json` — scripts, dependencies, lint/test setup.
- `docker-compose.yml` — spins up API + PostgreSQL services for local dev.
- `Dockerfile` — production-ready container build for the Nest app.
- `eslint.config.mjs`, `prettier` config — code quality setup.
- `scripts/generate-module.ts` — helper to scaffold new Nest modules.

## Getting started

### Prerequisites

- Node.js ≥ 18
- Yarn (`npm install -g yarn`) or npm
- Docker & Docker Compose (optional but recommended for PostgreSQL)

### Environment variables

Fill in a `.env` file at the project root (copy `.env.example` and adjust):

| Variable                      | Description                                          | Example / Default (dev)               |
| ----------------------------- | ---------------------------------------------------- | ------------------------------------- |
| `PORT`                        | API listening port (Render injects its own value)    | `3000`                                |
| `DB_HOST` / `DB_PORT`         | PostgreSQL connection                                | `localhost` / `5432`                  |
| `DB_USERNAME` / `DB_PASSWORD` | Database credentials                                 | `postgres` / `postgres`               |
| `DB_DATABASE`                 | Database name                                        | `heartie_db`                          |
| `REDIS_HOST` / `REDIS_PORT`   | Redis/BullMQ queue backend                           | `localhost` / `6379`                  |
| `REDIS_PASSWORD`              | Redis password (optional)                            | _(empty)_                             |
| `JWT_SECRET`                  | Access token secret                                  | `change_me_access`                    |
| `JWT_EXPIRATION_TIME`         | Access token TTL                                     | `3600s`                               |
| `JWT_REFRESH_SECRET`          | Refresh token secret                                 | `change_me_refresh`                   |
| `JWT_REFRESH_EXPIRATION_TIME` | Refresh token TTL                                    | `7d`                                  |
| `GEMINI_API_KEY`              | Google Gemini API key                                | —                                     |
| `GEMINI_AD_MODEL`             | (Optional) Gemini model for ads                      | `gemini-2.0-flash`                    |
| `GEMINI_ADMIN_MODEL`          | (Optional) Admin copilot model                       | `gemini-2.0-flash`                    |
| `GEMINI_REVIEW_MODEL`         | (Optional) Model for review insights                 | `gemini-1.5-pro`                      |
| `FIREBASE_PROJECT_ID`         | Firebase project id                                  | —                                     |
| `FIREBASE_CLIENT_EMAIL`       | Firebase service account email                       | —                                     |
| `FIREBASE_PRIVATE_KEY`        | Firebase service account private key                 | `"-----BEGIN PRIVATE KEY-----\\n..."` |
| `FIREBASE_ADMIN_TOPIC`        | Firebase topic for admin notifications               | `admin-orders`                        |
| `FB_GRAPH_API_URL`            | Facebook Graph API base URL                          | `https://graph.facebook.com/v24.0`    |
| `FACEBOOK_PAGE_ID`            | Facebook Page id                                     | —                                     |
| `FACEBOOK_PAGE_ACCESS_TOKEN`  | Long-lived Page access token                         | —                                     |
| `CORS_ORIGINS`                | Allowed origins (comma separated). Blank → allow all | `http://localhost:3000`               |

> ℹ️ The app fails fast if JWT secrets are missing. Ensure these env vars are set before starting Nest.

### Install dependencies

```bash
cd heartie-be
yarn install
```

### Run locally

1. Provision PostgreSQL (Docker recipe below or your own server).
2. Start the Nest server with hot reload:

```bash
yarn dev
```

3. Visit `http://localhost:3001/api-docs` for Swagger UI or hit `http://localhost:3001/` for the default health check.

TypeORM currently runs with `synchronize: true`, so tables are generated automatically during development.

### Run with Docker

Spin up Postgres only:

```bash
docker compose up -d db
```

Redis (BullMQ queues) is also available:

```bash
docker compose up -d redis
```

Run both API and DB inside containers:

```bash
docker compose up --build
```

- API becomes available on `http://localhost:3000` (mapped from container port 3000).
- To follow logs: `docker compose logs -f api`.
- The `db` service builds from `docker/db/Dockerfile`, which compiles the pgvector extension (and is the place to add more extensions for the whole team).
- Any SQL dropped in `docker/db/init/*.sql` runs automatically the first time a new data volume is created (for example `docker/db/init/00-extensions.sql` creates `vector`). Add more files there if you need additional extensions or bootstrap logic.

### Deploying to Render with Docker

Render can build the container image directly from this repository. Use these settings when creating a **Web Service**:

| Setting             | Value / Notes                                            |
| ------------------- | -------------------------------------------------------- |
| **Environment**     | Docker                                                   |
| **Dockerfile path** | `Dockerfile` (root)                                      |
| **Build command**   | _Leave empty_ (Render runs `docker build` automatically) |
| **Start command**   | _Leave empty_ (uses the `CMD` defined in the Dockerfile) |
| **Health check**    | `/api-docs` or another public endpoint                   |
| **Port**            | Render injects `PORT`; no manual mapping required        |

Required environment variables (copy from `.env.example`, adjust credentials/secrets):

- Database: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- Redis/BullMQ: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Auth: `JWT_SECRET`, `JWT_REFRESH_SECRET`, expiration variables
- Integrations: Gemini keys, Firebase admin credentials, Facebook tokens (optional)
- CORS: `CORS_ORIGINS` should include your front-end origin (e.g., `https://<app>.onrender.com`)

> 💾 **Persistent uploads**: The service serves files from `/app/uploads`. Attach a Render disk (persistent storage) mounted at `/uploads` or update `main.ts` to point to a cloud bucket if you need long-term file storage.

> 🔐 **Secrets**: Never commit production secrets. Populate them through the Render dashboard or Render CLI (`render env:set`).

### Seed data

Once the database is reachable (local server or Docker), populate baseline records:

```bash
yarn seed
```

By default this seeds every registered module (brands, attributes, categories, branches, banners, and demo users for each role). To target a specific module, pass its name as an argument:

```bash
yarn seed brands
yarn seed attributes
yarn seed categories
yarn seed branches
yarn seed banners
yarn seed users
yarn seed products
yarn seed brands categories attributes branches
```

Existing data is preserved (idempotent upsert). The brand seeder loads Nike, Adidas, Gucci, Zara, H&M, Uniqlo, Chanel, Dior, Levi’s, and Puma; the attribute seeder inserts baseline attributes (Màu sắc, Kích thước, Chất liệu); the category seeder creates the full men’s/women’s fashion hierarchy described above; the branch seeder provisions the primary Hồ Chí Minh, Hà Nội, and Đà Nẵng locations (with coordinates and phone numbers); the banner seeder injects a sample hero carousel; and the user seeder provisions one account per role (default password `Fashia@123`).

## Available scripts

| Command                 | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `yarn dev`              | Start Nest in watch mode (`nest start --watch`).                             |
| `yarn start`            | Start Nest in non-watch dev mode.                                            |
| `yarn start:debug`      | Start with inspector + watch for debugging.                                  |
| `yarn start:prod`       | Run the compiled app from `dist/`.                                           |
| `yarn build`            | Compile TypeScript to `dist/` using Nest CLI.                                |
| `yarn lint`             | Run ESLint (auto-fix enabled) on src/apps/libs/test.                         |
| `yarn test`             | Execute unit tests via Jest.                                                 |
| `yarn test:e2e`         | Run end-to-end tests (`test/app.e2e-spec.ts`).                               |
| `yarn format`           | Format code with Prettier.                                                   |
| `yarn gen:module`       | Scaffold a new Nest module using the helper script.                          |
| `yarn seed`             | Run the seeding script (optionally pass module names).                       |
| `yarn search:reindex`   | Backfill or rebuild Gemini embeddings for all products (stored in pgvector). |
| `yarn migration:run`    | Apply TypeORM migrations (uses `typeorm.config.ts`).                         |
| `yarn migration:revert` | Roll back the most recent migration.                                         |
| - `yarn lint`           | Run ESLint across the project.                                               |

## Semantic search setup

Semantic product search relies on the PostgreSQL `pgvector` extension and Gemini embeddings. Follow these steps before calling the API:

1. **Enable pgvector.** Connect to the store database and run:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

> 💡 **Extension missing?** If you see `vector.control` errors during migration, the server does not have pgvector installed. Install it first (`brew install pgvector` on macOS/Homebrew, `apt install postgresql-16-pgvector` on Debian/Ubuntu, or compile from [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)) or use `docker compose up -d db` to run the pre-built Postgres image that already ships with pgvector.

If the database already exists (for example staging/production), you can apply the included TypeORM migration instead:

```bash
yarn migration:run
```

The migration executes `CREATE EXTENSION IF NOT EXISTS vector;` so the command can be re-run safely when deploying to new environments.

2. **Configure Gemini credentials.** Set `GEMINI_API_KEY` (and optionally override `GEMINI_EMBEDDING_MODEL`).
3. **Generate embeddings (initial backfill).** Run the command below after enabling pgvector to populate vectors for the current catalog:

   ```bash
   yarn search:reindex
   ```

   This loads product metadata, calls Gemini for embeddings, and stores vectors in the `products.embedding` column. New products and updates trigger embedding refresh automatically; rerun the command only when you need to rebuild everything (for example after bulk migrations or model changes).

4. **Query the API.** Use `GET /search/semantic?query=<keywords>&limit=10` to retrieve ranked matches. Each result includes similarity score, variants (with option summaries), and attribute hints.

For large catalogs consider scheduling the reindex command nightly or after bulk imports.

## API reference

- Swagger UI: `GET /api-docs`
- Requires bearer tokens for protected routes (use the "Authorize" button).
- Static uploads served from `GET /uploads/*`.
- Common route prefixes:
  - `/auth` → register, login, logout, refresh
  - `/products`, `/categories`, `/product-variants`, `/banners`, `/interactions`, `/ratings`, `/orders`, `/vouchers`, etc.

## Testing

```bash
yarn test          # unit tests
yarn test:e2e      # e2e tests
yarn lint          # lint + auto-fix
```

The default Jest setup treats `src/` as the root and collects coverage into `coverage/`.

## Coding conventions

- DTOs live under each module’s `dto/` folder and are paired with class-validator decorators.
- Repositories are injected via `@InjectRepository` and operate on TypeORM entities (`entities/`).
- Services perform validation/business rules (e.g., checking foreign keys, enforcing rating bounds, deduplicating interactions).
- Controllers expose REST endpoints, leaning on services for logic.
- Global `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted`, and `transform` to keep payloads clean.
- Swagger decorators (`@ApiProperty`, etc.) keep docs synchronized with DTOs.

## Troubleshooting

- **`JwtStrategy requires a secret or key`** — ensure `JWT_SECRET` (and refresh secret) are defined in `.env` or runtime environment.
- **Database connection errors** — verify PostgreSQL is reachable with credentials from `.env`. When using Docker, confirm the `db` container is healthy and port 5432 is free.
- **Validation errors** — unexpected fields are blocked by `ValidationPipe`. Update the DTO or clean the client payload.

## Next steps

- Replace `synchronize: true` with migrations before production rollout.
- Implement missing update/list endpoints where marked TODO in services/controllers.
- Harden secrets management (Vault, SSM, or GitHub Actions secrets) for deployment.
- Add seed scripts for demo data and sample API collections (Postman/Thunder Client).

Enjoy building with Heartie! Contributions and suggestions are welcome.

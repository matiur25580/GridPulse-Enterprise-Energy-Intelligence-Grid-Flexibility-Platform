# GridPulse

**Enterprise Energy Intelligence & Grid Flexibility Platform**

GridPulse is a MEVN-based platform for multi-site energy monitoring, demand forecasting, energy optimization, renewable asset visibility, and demand-response workflows.

> **Project status:** Backend foundation is implemented: Express application structure, MongoDB/Mongoose connection, user registration and login, rotating refresh sessions, organization membership, tenant membership checks, role authorization middleware, request validation, and centralized API errors. Energy ingestion, forecasting, optimization, and grid workflows remain planned modules.

## Product goals

- Give organizations a unified view of energy use across facilities and meters.
- Ingest and explore time-series electricity readings.
- Forecast demand and explain model performance.
- Recommend cost-aware, constraint-aware energy schedules.
- Simulate demand-response participation and measure outcomes.
- Provide tenant isolation, role-based access, and auditable operations.

## Technology

- **Frontend:** Vue 3, TypeScript, Vite, Pinia, Vue Router, Apache ECharts
- **Backend:** Node.js 22+, Express 5
- **Data:** MongoDB 7+ with Mongoose
- **Security:** bcrypt password hashing, short-lived JWT access tokens, rotating opaque refresh tokens, HTTP-only cookies, Zod validation, Helmet, organization-scoped authorization
- **Quality:** Node's built-in test runner is configured; expanded integration coverage is next.

## Repository layout

```text
gridpulse/
├── client/                 # Vue 3 + TypeScript application
├── server/
│   └── src/
│       ├── config/         # Environment and database configuration
│       ├── controllers/    # HTTP handlers
│       ├── middleware/     # Authentication, tenant authorization, validation, errors
│       ├── models/         # User, organization, membership, refresh session
│       ├── routes/         # Versioned API routes
│       ├── schemas/        # Zod request schemas
│       ├── services/       # Token/session services
│       ├── utils/
│       ├── app.js
│       └── server.js
├── .env.example
└── package.json
```

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- MongoDB 7+ configured as a replica set (MongoDB Atlas is recommended; registration uses a transaction)

## Getting started

```bash
git clone https://github.com/matiur25580/GridPulse-Enterprise-Energy-Intelligence-Grid-Flexibility-Platform.git
cd GridPulse-Enterprise-Energy-Intelligence-Grid-Flexibility-Platform
npm install
cp .env.example .env
npm run dev
```

Update `MONGODB_URI` in `.env` to point to MongoDB Atlas or a local replica-set deployment. Replace `JWT_ACCESS_SECRET` with a randomly generated value of at least 32 characters before deployment. The sample secret is for local development only.

The Vue application runs at http://localhost:5173 and the API runs at http://localhost:4000. The Vite development server proxies `/api` requests to the API.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start client and API in development |
| `npm run dev:client` | Start Vue/Vite only |
| `npm run dev:server` | Start Express only |
| `npm run build` | Build the client |
| `npm run start` | Start the API (requires MongoDB) |
| `npm run test --workspace server` | Run server tests |

## API

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API process health |
| POST | `/auth/register` | Public | Create user, organization, and owner membership |
| POST | `/auth/login` | Public | Authenticate and issue tokens |
| POST | `/auth/refresh` | Refresh cookie | Rotate refresh session and issue access token |
| POST | `/auth/logout` | Refresh cookie | Revoke current refresh session |
| GET | `/auth/me` | Bearer access token | Current user and active organizations |
| GET | `/organizations` | Bearer access token | Organizations available to the current user |
| GET | `/organizations/:organizationId` | Bearer access token + membership | Organization details and caller's role |

### Authentication notes

- Registration requires `name`, `email`, `password`, and `organizationName`. Passwords must be at least 12 characters and include lowercase, uppercase, and numeric characters.
- The access token is returned in the response body and should be sent as `Authorization: Bearer <token>`.
- The refresh token is stored in an HTTP-only, same-site cookie scoped to `/api/v1/auth`; browser clients must send credentials on refresh/logout requests.
- Refresh tokens are random opaque values. Only SHA-256 hashes are stored, and successful refreshes rotate the session.
- Organization membership is checked by the API. The `x-organization-id` header is not accepted as proof of access; membership must exist in MongoDB.
- Roles defined for organization memberships: `owner`, `admin`, `operator`, `analyst`, and `viewer`. The authorization middleware is available for protected tenant routes.

### Example registration

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "ChangeThis-Password-2026",
  "organizationName": "Northwind Energy"
}
```

Health status reports API process health; it does not yet perform a separate readiness check for MongoDB.

## Architecture principles

1. **Tenant scope is mandatory:** tenant-owned routes must resolve membership server-side before accessing organization data.
2. **No client-side trust:** roles, prices, meter ownership, and approval decisions are validated by the API.
3. **Idempotent ingestion:** duplicate meter events must not create duplicate readings.
4. **Explainable intelligence:** forecasts and recommendations must expose inputs, assumptions, constraints, and evaluation metrics.
5. **Safe-by-default operations:** the initial product simulates control actions; it does not directly operate physical industrial equipment.
6. **Honest product status:** documentation distinguishes implemented behavior from roadmap items.

## Planned delivery sequence

1. Foundation, configuration, API conventions, and automated checks.
2. Authentication, organizations, memberships, and tenant-aware authorization — initial implementation committed; integration hardening and expanded tests remain.
3. Facilities, meters, and validated energy-reading ingestion.
4. Time-series dashboards and real-time updates.
5. Forecasting, anomaly detection, and model evaluation.
6. Optimization scenarios and demand-response simulation.
7. Renewable assets, billing, reporting, audit, and operational hardening.

## Security

Never commit real credentials, production connection strings, private meter data, or customer information. Keep `.env` untracked. Configure HTTPS and set `COOKIE_SECURE=true` in production. Use independent, randomly generated secrets in each environment.

## License

No license has been selected yet. Until one is added, all rights are reserved by default.

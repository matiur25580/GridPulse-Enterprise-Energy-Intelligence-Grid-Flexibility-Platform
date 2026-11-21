# GridPulse

**Enterprise Energy Intelligence & Grid Flexibility Platform**

GridPulse is a MEVN-based platform for multi-site energy monitoring, demand forecasting, energy optimization, renewable asset visibility, and demand-response workflows.

> **Project status:** Implemented foundations include Express/Mongoose configuration, authentication with rotating refresh sessions, organization membership and role checks, facility and meter management, and tenant-scoped energy-reading ingestion/query APIs. Forecasting, optimization, renewable asset operations, and grid workflows remain planned modules.

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
- **Security:** bcrypt password hashing, JWT access tokens, rotating opaque refresh tokens, HTTP-only cookies, Zod validation, Helmet, organization-scoped authorization
- **Quality:** Node's built-in test runner; schema validation tests included.

## Repository layout

```text
gridpulse/
├── client/                 # Vue 3 + TypeScript application
├── server/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/          # Users, organizations, facilities, meters, readings
│       ├── routes/
│       ├── schemas/
│       ├── services/
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

Set `MONGODB_URI` to your Atlas or local replica-set connection string. Replace the sample JWT secret with a randomly generated value of at least 32 characters before deployment.

The Vue application runs at http://localhost:5173 and the API runs at http://localhost:4000.

## API

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API process health |
| POST | `/auth/register` | Public | Create user, organization, and owner membership |
| POST | `/auth/login` | Public | Authenticate |
| POST | `/auth/refresh` | Refresh cookie | Rotate refresh session |
| POST | `/auth/logout` | Refresh cookie | Revoke current session |
| GET | `/auth/me` | Bearer token | Current user and organizations |
| GET | `/organizations` | Bearer token | List organizations |
| GET | `/organizations/:organizationId` | Organization member | Organization details |
| GET | `/organizations/:organizationId/facilities` | Organization member | List facilities |
| POST | `/organizations/:organizationId/facilities` | Owner/admin/operator | Create facility |
| GET | `/organizations/:organizationId/facilities/:facilityId` | Organization member | Get facility |
| GET | `/organizations/:organizationId/meters` | Organization member | List meters; optional `?facilityId=` |
| POST | `/organizations/:organizationId/meters` | Owner/admin/operator | Register a meter |
| POST | `/organizations/:organizationId/meters/:meterId/readings` | Owner/admin/operator | Ingest up to 1,000 readings |
| GET | `/organizations/:organizationId/meters/:meterId/readings` | Organization member | Query readings with optional `from`, `to`, `page`, and `limit` |

### Facility example

```json
{
  "name": "Pune Manufacturing Plant",
  "code": "PUNE-PLANT-01",
  "facilityType": "industrial",
  "timezone": "Asia/Kolkata",
  "address": { "city": "Pune", "region": "Maharashtra", "country": "India" }
}
```

### Meter example

```json
{
  "facilityId": "YOUR_FACILITY_OBJECT_ID",
  "name": "Main Incoming Meter",
  "serialNumber": "MTR-PUNE-0001",
  "meterType": "main",
  "ratedPowerKw": 850
}
```

### Energy reading batch example

```json
{
  "readings": [
    {
      "externalId": "gateway-01:2026-11-21T10:00:00Z",
      "recordedAt": "2026-11-21T10:00:00Z",
      "energyKwh": 124.75,
      "demandKw": 498.2,
      "voltageV": 415,
      "powerFactor": 0.96,
      "source": "gateway",
      "quality": "valid"
    }
  ]
}
```

Reading `externalId` values are idempotency keys scoped to an organization and meter. Replayed IDs are not inserted again. A batch accepts 1–1,000 readings; duplicate IDs inside the same batch are rejected. Readings are stored in kWh with optional demand and electrical measurements.

### Tenant and role controls

Every facility, meter, and reading query is scoped to the organization resolved from the authenticated user's active membership. A meter can only be registered against a facility in that same organization. The organization ID in the URL is a lookup context, never proof of access.

Roles available: `owner`, `admin`, `operator`, `analyst`, and `viewer`. All members can read; only owner/admin/operator can create facilities, register meters, or ingest readings.

## Architecture principles

1. **Tenant scope is mandatory:** tenant-owned reads and writes include the verified organization ID.
2. **No client-side trust:** roles and ownership are checked by the API.
3. **Idempotent ingestion:** event identifiers prevent duplicate readings on retries.
4. **Explainable intelligence:** future forecasts and recommendations will expose inputs, assumptions, constraints, and evaluation metrics.
5. **Safe-by-default operations:** initial product workflows simulate control actions; they do not directly operate physical industrial equipment.
6. **Honest product status:** implemented behavior is distinguished from roadmap items.

## Roadmap

1. Foundation and API conventions — implemented.
2. Authentication, organizations, memberships, tenant-aware authorization — initial implementation complete; integration hardening remains.
3. Facilities, meters, and energy-reading ingestion — initial APIs and models implemented; database-backed integration tests remain.
4. Time-series dashboards and real-time updates.
5. Forecasting, anomaly detection, and model evaluation.
6. Optimization scenarios and demand-response simulation.
7. Renewable assets, billing, reporting, audit, and operational hardening.

## Security

Never commit real credentials, production connection strings, private meter data, or customer information. Keep `.env` untracked. Configure HTTPS and `COOKIE_SECURE=true` in production.

## License

No license has been selected yet. Until one is added, all rights are reserved by default.

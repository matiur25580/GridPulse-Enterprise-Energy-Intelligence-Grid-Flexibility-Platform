# GridPulse

**Enterprise Energy Intelligence & Grid Flexibility Platform**

GridPulse is a MEVN-based platform for multi-site energy monitoring, demand forecasting, energy optimization, renewable asset visibility, and demand-response workflows.

> **Project status:** Foundation scaffold. The current code provides the Vue/Vite client, Express API health endpoint, workspace scripts, and local development configuration. Energy ingestion, forecasting, optimization, and grid workflows are planned modules—not implemented features yet.

## Product goals

- Give organizations a unified view of energy use across facilities and meters.
- Ingest and explore time-series electricity readings.
- Forecast demand and explain model performance.
- Recommend cost-aware, constraint-aware energy schedules.
- Simulate demand-response participation and measure outcomes.
- Provide tenant isolation, role-based access, and auditable operations.

## Technology

- **Frontend:** Vue 3, TypeScript, Vite, Pinia, Vue Router, Apache ECharts
- **Backend:** Node.js, Express
- **Data:** MongoDB with Mongoose (planned in the next backend milestone)
- **Real-time:** Socket.IO (planned)
- **Quality:** Vitest, Supertest, Playwright (to be introduced with the relevant modules)
- **Operations:** Docker and GitHub Actions (planned)

## Repository layout

```text
gridpulse/
├── client/                 # Vue 3 + TypeScript application
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── router/
│   │   ├── stores/
│   │   ├── views/
│   │   ├── App.vue
│   │   └── main.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express API
│   ├── src/
│   │   └── server.js
│   └── package.json
├── .env.example
├── .gitignore
└── package.json            # npm workspaces and shared scripts
```

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- MongoDB 7+ (needed when persistence is introduced)

## Getting started

```bash
git clone https://github.com/matiur25580/GridPulse-Enterprise-Energy-Intelligence-Grid-Flexibility-Platform.git
cd GridPulse-Enterprise-Energy-Intelligence-Grid-Flexibility-Platform
npm install
cp .env.example .env
npm run dev
```

The Vue application runs at http://localhost:5173 and the API runs at http://localhost:4000. The Vite development server proxies `/api` requests to the API.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start client and API in development |
| `npm run dev:client` | Start Vue/Vite only |
| `npm run dev:server` | Start Express only |
| `npm run build` | Build the client |
| `npm run start` | Start the API in production mode |

## Initial API

- `GET /api/v1/health` — process health and service metadata

Health status is not a readiness check for external dependencies. Database and queue readiness probes will be added when those services are integrated.

## Architecture principles

1. **Tenant scope is mandatory:** every tenant-owned query and mutation must be scoped server-side to an authenticated organization.
2. **No client-side trust:** roles, prices, meter ownership, and approval decisions are validated by the API.
3. **Idempotent ingestion:** duplicate meter events must not create duplicate readings.
4. **Explainable intelligence:** forecasts and recommendations must expose inputs, assumptions, constraints, and evaluation metrics.
5. **Safe-by-default operations:** the initial product simulates control actions; it does not directly operate physical industrial equipment.
6. **Honest product status:** documentation distinguishes implemented behavior from roadmap items.

## Planned delivery sequence

1. Foundation, configuration, API conventions, and automated checks.
2. Authentication, organizations, memberships, and tenant-aware authorization.
3. Facilities, meters, and validated energy-reading ingestion.
4. Time-series dashboards and real-time updates.
5. Forecasting, anomaly detection, and model evaluation.
6. Optimization scenarios and demand-response simulation.
7. Renewable assets, billing, reporting, audit, and operational hardening.

## Security

Never commit real credentials, production connection strings, private meter data, or customer information. Copy `.env.example` to `.env` for local development and keep `.env` untracked.

## License

No license has been selected yet. Until one is added, all rights are reserved by default.

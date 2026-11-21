# GridPulse

**Enterprise Energy Intelligence & Grid Flexibility Platform**

GridPulse is a MEVN-based platform for multi-site energy monitoring, demand forecasting, energy optimization, renewable asset visibility, and demand-response workflows.

> **Project status:** Implemented foundations include Express/Mongoose configuration, authentication with rotating refresh sessions, organization membership and role checks, facility and meter management, tenant-scoped energy-reading ingestion/query APIs, and a tenant-scoped energy overview analytics endpoint. The frontend now includes registration/login, refresh-cookie session restoration, organization selection, logout, and tenant-scoped live analytics loading. Empty telemetry states are shown explicitly; no synthetic production metrics are presented. Explainable forecasting, anomaly detection, rolling-origin model evaluation, an advisory tariff-aware optimization simulator, an initial solar/demand-response scenario engine, tenant-scoped enterprise energy reporting, and facility-specific tariff and bill-estimation workflows are implemented; utility integrations, invoice settlement, and production hardening remain planned.

## Product goals

- Give organizations a unified view of energy use across facilities and meters.
- Ingest and explore time-series electricity readings.
- Forecast demand and explain model performance.
- Recommend cost-aware, constraint-aware energy schedules.
- Model facility-specific tariffs and estimate transparent energy bills.
- Simulate demand-response participation and measure outcomes.
- Provide tenant isolation, role-based access, and auditable operations.

## Technology

- **Frontend:** Vue 3, TypeScript, Vite, Pinia, Vue Router, Apache ECharts
- **Backend:** Node.js 22+, Express 5
- **Data:** MongoDB 7+ with Mongoose
- **Security:** bcrypt password hashing, JWT access tokens, rotating opaque refresh tokens, HTTP-only cookies, Zod validation, Helmet, organization-scoped authorization
- **Quality:** Node's built-in test runner; schema validation tests included. Frontend TypeScript/Vite production build is available through `npm run build`.

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

Run the available checks with `npm test --workspace server` and build the frontend with `npm run build`.

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
| GET | `/organizations/:organizationId/analytics/overview` | Organization member | Portfolio KPIs, daily usage, facility breakdown, and data-quality counts |
| GET | `/organizations/:organizationId/analytics/intelligence` | Organization member | Explainable energy forecast and meter-level consumption anomaly detection |
| POST | `/organizations/:organizationId/optimization/simulate` | Organization member | Simulate tariff-aware load shifting and battery dispatch against observed hourly energy data |
| POST | `/organizations/:organizationId/grid-flexibility/simulate` | Organization member | Estimate solar self-consumption, surplus generation, demand-response impact and avoided emissions |
| GET | `/organizations/:organizationId/reports/energy` | Organization member | Generate a bounded-period energy, facility, meter, data-quality and indicative emissions report |
| GET | `/organizations/:organizationId/billing/tariffs` | Organization member | List facility-specific tariff versions |
| POST | `/organizations/:organizationId/billing/tariffs` | Owner/admin/operator | Create a tariff version; automatically closes an earlier open-ended version |
| POST | `/organizations/:organizationId/billing/bills/estimate` | Owner/admin/operator/analyst | Calculate and save a tenant-scoped bill estimate |
| GET | `/organizations/:organizationId/billing/bills` | Organization member | List saved bill estimates |
| GET | `/organizations/:organizationId/billing/bills/:billId` | Organization member | Retrieve a saved estimate snapshot |

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


### Frontend authentication and live analytics

The client calls the same-origin `/api/v1` endpoints through the Vite development proxy. Access tokens are held in application memory; refresh tokens remain in HTTP-only cookies and are never exposed to JavaScript. On a protected request that returns 401, the API client attempts one refresh and retries the request once. Reloading the page attempts session restoration before showing the workspace.

After sign-in, the client loads the user's organizations and allows switching between memberships. The selected organization ID is used only as request context; the API independently verifies membership and scopes every analytics query to the authenticated organization.

The overview requests `GET /organizations/:organizationId/analytics/overview` for the selected 7-, 30-, or 90-day window. Charts, summary metrics, and facility rows use the returned API data. If no readings exist, the UI displays an empty state rather than fabricated operational figures. New accounts can be created from the sign-in screen; the registration API creates the first organization and owner membership.

### Facility, meter, and telemetry workspace

The authenticated dashboard includes an asset-operations workspace with three views:

- **Facilities:** list organization facilities and create a site with a unique organization-scoped code, facility type, timezone, and address details.
- **Meters:** browse the organization's meters, filter by facility, and register a meter against an active facility. The server verifies the facility belongs to the current organization.
- **Energy readings:** inspect the latest 20 readings for a selected meter and submit a manual reading with timestamp, kWh, optional kW demand and power factor, source, and quality metadata.

Create and ingestion controls are shown to owner, admin, and operator members. The API remains authoritative for permissions; read-only roles can browse inventory and readings. Each manual reading receives a unique event ID so retries are safe under the server's idempotent ingestion contract. The workspace refreshes its inventory and reading list after successful writes.
### Energy forecasting and anomaly intelligence

`GET /organizations/:organizationId/analytics/intelligence?historyDays=30&horizonDays=7` returns an organization-scoped forecast and unusual-consumption candidates. `historyDays` is bounded to 7–90 days and `horizonDays` to 1–14 days.

- **Forecast:** seven-day moving-average baseline with a linear trend fitted to up to fourteen observed daily totals. The daily trend is capped at 15% of the baseline. Lower/upper bands are heuristic uncertainty ranges, not calibrated statistical confidence intervals.
- **Anomalies:** daily meter totals are compared with up to fourteen preceding observed days using a rolling median and median absolute deviation (MAD). At least seven prior observations are required. High/medium severity and baseline/threshold/deviation values are returned for explainability.
- **Data quality:** valid and estimated readings are included; flagged readings are excluded. The response includes the selected history window and methodology. A rolling-origin one-day-ahead backtest reports MAE, RMSE, MAPE, WAPE and mean error/bias, with actual-versus-predicted points and facility-level metrics. Only contiguous observed daily points are evaluated; each prediction uses strictly earlier observations. MAPE excludes zero-actual days. At least eight consecutive daily observations are needed for an initial score. Metrics describe historical performance and do not guarantee future accuracy. A rolling-origin one-day-ahead backtest reports MAE, RMSE, MAPE, WAPE, mean error/bias, actual-versus-predicted points, and facility-level metrics. Backtesting evaluates only contiguous observed days and uses strictly prior observations for each prediction; MAPE excludes zero-actual days. A minimum of eight consecutive daily observations is required for the first score. Metrics are descriptive and should not be interpreted as guaranteed future performance.

This first intelligence release is deterministic and explainable. It is not a trained machine-learning model, does not claim probabilistic forecast accuracy, and does not automatically control equipment. Anomaly candidates should be reviewed against operational context before action.

### Energy optimization and flexibility scenarios

`POST /organizations/:organizationId/optimization/simulate` runs an organization-scoped, read-only planning scenario using the previous 7–90 days of valid and estimated telemetry. The request supplies off-peak and peak tariff rates, peak hours (UTC), and optional battery capacity, power, state-of-charge, reserve, and round-trip efficiency. The response compares representative-day baseline and optimized cost/energy/peak demand, provides estimated savings and a 24-hour dispatch schedule, and returns data coverage plus explicit model assumptions.

The simulator averages observed daily energy by UTC hour, shifts battery charging into configured off-peak hours, and dispatches stored energy during peak hours subject to capacity, power, reserve, and efficiency limits. If demand measurements are absent, hourly energy is used as an indicative average-kW proxy and disclosed in the response. It does not infer utility tariff rules, demand charges, taxes, battery degradation, or local-time daylight-saving behavior. Results are indicative scenario estimates, not guaranteed savings or an operational dispatch plan. No commands are sent to meters, batteries, or grid equipment.


### Renewable energy and demand-response intelligence

`POST /organizations/:organizationId/grid-flexibility/simulate` evaluates the previous 7–90 days of organization telemetry. The request supplies selected event hours (UTC), a hypothetical grid-import reduction percentage, an incentive rate per curtailed kWh, and a grid emissions factor.

- **Renewable analytics:** readings from active meters classified as `solar` are treated as generation. Active `main` meters provide facility load; `submeter` readings are used only as a disclosed fallback when no main-meter readings exist. The service estimates hourly self-consumption as the minimum of load and solar generation only when both meter types have readings for that hour. It estimates surplus/export as solar generation above load only for those overlapping intervals; unmatched solar intervals are excluded from self-consumption/export ratios. These are profile-derived estimates, not revenue-grade export measurements.
- **Demand response:** the scenario applies the configured percentage reduction to modeled grid import during selected event hours. It reports curtailed energy, post-event import, and an illustrative incentive estimate. It does not establish a verified baseline, prove that flexible capacity is available, or execute dispatch.
- **Emissions:** avoided CO2e is estimated from the supplied grid emissions factor multiplied by modeled solar self-consumption plus demand-response reduction. Annualized tonnes are a straight-line 365-day projection, not a forecast.
- **Data quality:** valid and estimated readings are included; flagged readings are excluded. Hourly profiles are averaged across observed UTC days. Missing hours remain missing/zero in the schedule and are identified in coverage fields.

The API returns assumptions, data coverage, hourly load/generation, estimated self-consumption/export, demand-response impact and emissions. No commands are sent to meters, inverters, batteries, or grid equipment. Financial incentives exclude program qualification, settlement rules, demand baselines, penalties, taxes and fees.


### Enterprise energy reporting

`GET /organizations/:organizationId/reports/energy?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z&gridEmissionFactorKgPerKwh=0.4` returns a tenant-scoped report for a period of up to 366 days. The authenticated reporting workspace lets organization members select a period and emissions factor, review KPIs and daily/facility/meter detail, export CSV, or use the browser print dialog to save a PDF.

- **Portfolio performance:** total and average daily energy, maximum measured demand, average power factor, and included reading count.
- **Facility and meter detail:** consumption, demand and reading counts by facility; meter-level energy grouped by reading quality.
- **Data quality:** valid and estimated readings are included in energy, demand and emissions calculations. Flagged readings are reported separately and excluded from those totals.
- **Indicative emissions:** included electricity consumption multiplied by the user-supplied grid emissions factor. The factor defaults to 0.4 kg CO2e/kWh and is configurable from 0 to 5. It is not a verified inventory or regulatory factor selection.
- **Exports:** CSV contains summary, daily, facility, meter and quality sections. Print/PDF creates a formatted report through the browser's print dialog.

The report is intended for operational management and internal review. This energy-report endpoint does not embed bill line items; facility-specific tariff plans and estimated billing snapshots are available in the separate Billing workspace. It does not establish GHG Protocol boundary completeness, market-based emissions, Scope 2 contractual instruments, assurance, or regulatory compliance. UTC is used for daily aggregation and report date boundaries.


### Enterprise billing and energy cost intelligence

The authenticated **Tariffs & Billing** workspace supports facility-specific tariff configuration and reproducible operational bill estimates.

- **Tariff versioning:** configure currency, a default per-kWh rate, up to twelve time-of-use rate bands, applicable local hours and weekdays, effective dates, fixed service charge, measured-demand charge per kW, and a configurable tax/surcharge percentage. Active tariff effective periods for the same facility cannot overlap. Creating a later version automatically closes a previous open-ended version on the day before the new effective date; existing bill snapshots retain their original tariff inputs.
- **Time-of-use billing:** eligible readings are grouped by the facility's IANA timezone and local hour/day. Configured rate bands are applied to matching intervals; unmatched intervals use the default rate.
- **Demand and fixed charges:** demand charges use the maximum measured kW in the selected billing period. When demand telemetry is absent, no demand charge is invented and the estimate explains the omission. Fixed charge is applied once per billing period.
- **Data quality and meter selection:** valid and estimated readings are included; flagged readings are excluded. Active main meters are preferred. Active submeters are used only when no eligible main-meter data exists for the period. The estimate reports its source, observed hours/days, reading count, and estimated-reading count.
- **Period comparison:** the immediately preceding equal-length period is recalculated using the same selected tariff version. This is a like-for-like modeled comparison, not a copy of an earlier utility invoice.
- **Cost optimization:** the engine surfaces an illustrative 10% load-shifting opportunity based on observed energy in higher-priced intervals and the lowest configured tariff rate. It is not a guaranteed saving or dispatch instruction.
- **Saved estimates:** bill calculation snapshots preserve the tariff inputs, charge components, daily details, coverage, comparison and calculation version. Re-generating the same facility/tariff/period refreshes that estimate snapshot.
- **Export:** each saved estimate can be exported as a CSV containing charge breakdown, daily energy, comparison and data coverage.

Endpoints:
- `GET/POST /organizations/:organizationId/billing/tariffs`
- `POST /organizations/:organizationId/billing/bills/estimate`
- `GET /organizations/:organizationId/billing/bills`
- `GET /organizations/:organizationId/billing/bills/:billId`

The calculator is an operational planning estimate, not a utility-issued invoice, tax invoice, payment collection system, settlement statement, or statutory accounting ledger. It does not yet model utility-specific slab tiers, power-factor penalties, contracted-demand ratchets, time-of-use holidays, meter multipliers, export credits, arrears, late fees, or jurisdiction-specific tax rules. Rates and tax percentages must be entered by an authorized organization user and verified against the applicable utility contract.

### Tenant and role controls

Every facility, meter, and reading query is scoped to the organization resolved from the authenticated user's active membership. A meter can only be registered against a facility in that same organization. The organization ID in the URL is a lookup context, never proof of access.

Roles available: `owner`, `admin`, `operator`, `analyst`, and `viewer`. All members can read; only owner/admin/operator can create facilities, register meters, ingest readings, or configure tariff versions. Owner/admin/operator/analyst can generate bill estimates; viewer is read-only.

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
3. Facilities, meters, and energy-reading ingestion — APIs, models, and authenticated management UI implemented; database-backed integration tests remain.
4. Portfolio analytics endpoint and authenticated live-data dashboard — initial implementation complete; integration tests remain.
5. Explainable baseline forecasting, anomaly detection, rolling-origin backtesting, and authenticated intelligence dashboard — initial implementation complete; advanced model evaluation and monitoring remain.
6. Tariff-aware optimization scenario API and battery dispatch simulation — initial implementation complete; direct integration with the persisted billing tariff catalog and production validation remain.
7. Renewable energy and demand-response advisory simulation — initial implementation complete; metered exports, settlement, and production integration remain.
8. Enterprise energy reporting with CSV and print-to-PDF exports — initial implementation complete; formal emissions inventory, audit controls, and compliance workflows remain.
9. Facility-specific tariff versioning, time-of-use cost calculation, demand charges, saved bill estimates, period comparisons, and CSV exports — initial implementation complete; utility integrations, invoice settlement, and jurisdiction-specific tariff rules remain.
10. Production hardening, observability, and integration testing.

## Security

Never commit real credentials, production connection strings, private meter data, or customer information. Keep `.env` untracked. Configure HTTPS and `COOKIE_SECURE=true` in production.

## License

No license has been selected yet. Until one is added, all rights are reserved by default.

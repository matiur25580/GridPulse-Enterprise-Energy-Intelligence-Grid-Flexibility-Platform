# GridPulse

**Enterprise Energy Intelligence & Grid Flexibility Platform**

GridPulse is a MEVN-based platform for multi-site energy monitoring, demand forecasting, energy optimization, renewable asset visibility, and demand-response workflows.

> **Project status:** Implemented foundations include Express/Mongoose configuration, authentication with rotating refresh sessions, organization membership and role checks, facility and meter management, tenant-scoped energy-reading ingestion/query APIs, and a tenant-scoped energy overview analytics endpoint. The frontend now includes registration/login, refresh-cookie session restoration, organization selection, logout, and tenant-scoped live analytics loading. Empty telemetry states are shown explicitly; no synthetic production metrics are presented. Explainable forecasting, anomaly detection, rolling-origin model evaluation, advisory energy optimization, solar/demand-response scenarios, enterprise energy reporting, facility-specific tariffs and bill estimates, audited CSV meter imports, actual-versus-estimated utility invoice reconciliation, signed generic IoT gateway webhooks, and on-demand alert rules with incident acknowledgement/recovery are implemented. Vendor-specific utility/IoT connectors, scheduled polling, background alert evaluation and notification delivery, invoice OCR, settlement, and production hardening remain planned.

## Product goals

- Give organizations a unified view of energy use across facilities and meters.
- Ingest and explore time-series electricity readings from CSV batches and signed IoT gateway webhooks.
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
| POST | `/organizations/:organizationId/meters/:meterId/imports/csv` | Owner/admin/operator | Import up to 1,000 timezone-aware meter readings from a CSV batch |
| GET | `/organizations/:organizationId/integrations/meter-imports` | Organization member | List import batches and ingestion outcomes |
| POST | `/organizations/:organizationId/integrations/utility-invoices/reconcile` | Owner/admin/operator/analyst | Record an actual utility invoice and compare it with a fresh tariff-based estimate |
| GET | `/organizations/:organizationId/integrations/utility-invoices` | Organization member | List utility invoice reconciliation records |
| GET | `/organizations/:organizationId/integrations/gateways` | Organization member | List gateway sources, meter mappings, counters and freshness health |
| POST | `/organizations/:organizationId/integrations/gateways` | Owner/admin/operator | Provision a signed webhook source and one-time signing secret |
| POST | `/organizations/:organizationId/integrations/gateways/:sourceId/rotate-secret` | Owner/admin/operator | Immediately rotate a gateway signing secret |
| PATCH | `/organizations/:organizationId/integrations/gateways/:sourceId/status` | Owner/admin/operator | Enable or disable a gateway source |
| POST | `/integrations/gateways/:sourceId/readings` | HMAC-signed gateway | Receive up to 500 signed telemetry events |
| GET | `/organizations/:organizationId/alerts/rules` | Organization member | List organization alert rules |
| POST | `/organizations/:organizationId/alerts/rules` | Owner/admin/operator | Create a facility, meter, or gateway alert rule |
| PATCH | `/organizations/:organizationId/alerts/rules/:ruleId` | Owner/admin/operator | Enable or disable an alert rule |
| GET | `/organizations/:organizationId/alerts/incidents` | Organization member | List incidents; optional status, severity and limit filters |
| POST | `/organizations/:organizationId/alerts/evaluate` | Owner/admin/operator | Evaluate active rules against current telemetry and update incidents |
| PATCH | `/organizations/:organizationId/alerts/incidents/:incidentId` | Owner/admin/operator | Acknowledge or resolve an active incident |

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


### Meter data pipelines and utility invoice reconciliation

The **Integrations & Reconciliation** workspace adds controlled batch ingestion and actual-versus-modeled invoice checks.

**CSV meter imports**
- Upload CSV against an active meter belonging to the selected organization. Required columns are `externalId`, `recordedAt`, and `energyKwh`; optional columns are `demandKw`, `voltageV`, `currentA`, `powerFactor`, and `quality`.
- Timestamps must be ISO-compatible and include `Z` or an explicit UTC offset. Energy and electrical measurements are validated; unsupported columns, malformed quoting, duplicate event IDs in a file, and oversized batches are rejected.
- A batch accepts at most 1,000 readings and 900 KB of CSV content. Imported readings are tagged `source: import`; the existing organization/meter/event unique key makes individual readings idempotent.
- Each import has a caller-supplied batch ID, SHA-256 content fingerprint, status, file name, received/inserted/duplicate counts, timestamps, and failure summary. Replaying a completed batch with identical content returns the original result. Reusing its ID with different content is rejected. Failed batches can be retried with the same ID and unchanged content; already inserted readings are safely recognized as duplicates.
- The import history is visible to organization members. Only owner/admin/operator roles can ingest CSV.

CSV example:

```csv
externalId,recordedAt,energyKwh,demandKw,powerFactor,quality
gateway-01:reading-0001,2026-11-01T10:00:00Z,124.75,48.2,0.96,valid
gateway-01:reading-0002,2026-11-01T11:00:00+05:30,121.40,46.8,0.95,valid
```

Example request body for the CSV endpoint:

```json
{
  "externalBatchId": "gateway-01-batch-2026-11-01",
  "fileName": "plant-meter-readings.csv",
  "csv": "externalId,recordedAt,energyKwh\ngateway-01:reading-0001,2026-11-01T10:00:00Z,124.75"
}
```

**Utility invoice reconciliation**
- An authorized user records supplier, invoice number, facility, billing dates, invoice currency, actual billed kWh, actual total, optional measured peak demand, and an acceptable amount-variance tolerance.
- GridPulse generates a new bill estimate using the selected facility tariff and eligible telemetry for the exact same period. Invoice currency must match the tariff currency.
- The saved reconciliation reports actual and estimated amounts, absolute and percentage amount variance, actual and estimated energy, energy variance, and demand variance when both demand values are available.
- A result is marked `within_tolerance` only when a non-zero estimate permits a percentage comparison and the absolute amount variance is within the configured threshold. Otherwise it is marked `discrepancy`; unavailable percentage/demand comparisons are explicitly explained.
- Invoice numbers are unique within a facility and organization. Reconciliation history is retained and can be reviewed by organization members. Owner/admin/operator/analyst roles can submit reconciliations.

This is a manual invoice-data entry and reconciliation workflow, not a direct utility-provider API integration, automated scheduled meter polling, OCR invoice extraction, payment system, or accounting ledger. CSV ingestion is user-initiated; the audit records provide the foundation for later gateway adapters, scheduled synchronization, and exception notifications. Imported meter data is not silently treated as verified utility data. Review source records and supplier invoice details before acting on discrepancies.


### Live IoT gateway webhooks

The **Live IoT gateway connection** panel provisions a generic signed webhook source. It is a provider-neutral adapter contract that can be implemented by an edge gateway, site controller, or upstream telemetry service.

**Provisioning and credentials**
- An owner/admin/operator creates a source, maps external meter IDs to active meters in the same organization, and sets an expected reporting interval (1–1,440 minutes).
- GridPulse generates a 256-bit random signing secret and returns it only at creation or explicit rotation. Store it in the gateway's secret manager; it cannot be retrieved from the API later.
- Secrets are encrypted at rest with AES-256-GCM. Configure `INTEGRATION_ENCRYPTION_KEY` as a persistent, private value of at least 32 characters. The application derives a 256-bit encryption key from it. Do not change or lose this key without first migrating/re-encrypting all configured gateway credentials; losing it makes existing sources unable to authenticate.
- Rotation immediately invalidates the previous secret. Disable a source to reject its incoming events without deleting its audit history.

**Signed event contract**
- Endpoint: `POST /api/v1/integrations/gateways/:sourceId/readings`.
- Send JSON with an `events` array of 1–500 events. Each event contains `eventId`, `externalMeterId`, timezone-aware ISO `recordedAt`, and non-negative `energyKwh`. Optional fields: `demandKw`, `voltageV`, `currentA`, `powerFactor`, and `quality`.
- Include `X-GridPulse-Timestamp` (Unix seconds) and `X-GridPulse-Signature` headers. Signature is `sha256=` followed by the lowercase hex HMAC-SHA256 of `timestamp + "." + exact raw JSON request body`, using the provisioned signing secret as the UTF-8 HMAC key.
- Signed timestamps must be within five minutes of server time. The signature is compared in constant time. Re-serialize JSON only once and sign the exact bytes sent; whitespace or property-order changes invalidate the signature.
- Each external meter ID must be mapped to an active local meter. Event IDs are idempotent within the organization/meter key. Events are stored as `source: gateway`; the API never exposes the signing secret after provisioning.
- The response reports received, inserted and duplicate counts. Gateway health is `awaiting_data` before the first successful event, `healthy` while the last successful delivery is within three expected intervals, `stale` after that threshold, and `disabled` when the source is disabled.

Example event body:

```json
{
  "events": [
    {
      "eventId": "edge-01-0000451",
      "externalMeterId": "plant-main-meter",
      "recordedAt": "2026-11-21T10:15:00+05:30",
      "energyKwh": 124.75,
      "demandKw": 498.2,
      "powerFactor": 0.96,
      "quality": "valid"
    }
  ]
}
```

Example Node.js signing logic (send `rawBody` unchanged):

```js
import { createHmac } from 'node:crypto'

const timestamp = Math.floor(Date.now() / 1000).toString()
const rawBody = JSON.stringify(payload)
const signature = 'sha256=' + createHmac('sha256', signingSecret)
  .update(timestamp + '.')
  .update(rawBody)
  .digest('hex')

await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-GridPulse-Timestamp': timestamp,
    'X-GridPulse-Signature': signature,
  },
  body: rawBody,
})
```

The endpoint currently accepts provider-neutral HTTP webhooks. MQTT broker subscriptions, Modbus polling, vendor-specific cloud APIs, scheduled backfills, outbound notifications, and hardware command/control are not implemented. Gateway health is a freshness indicator in the workspace, not a guaranteed delivery SLA or an alert delivery service.


### Intelligent alerts and incident operations

The **Alerts & incidents** workspace provides organization-scoped monitoring rules and a deduplicated incident queue.

**Supported rules**
- **High consumption:** sums valid and estimated readings for a selected facility or meter over a configurable 5-minute to 7-day observation window. An incident is created only when observed energy strictly exceeds the configured kWh threshold.
- **Meter silence:** detects a meter with no recorded reading inside its configured 5-minute to 7-day freshness window, including meters that have never delivered telemetry.
- **Gateway silence:** detects a gateway source with no successful signed delivery inside its configured freshness window, including newly provisioned sources that have never delivered data.

Rules carry low, medium, high, or critical severity. Only active facilities, meters, and gateway sources in the current organization can be selected as targets. Rule creation and management are restricted to owner/admin/operator roles; all organization members can view rules and incidents.

**Incident lifecycle**
- Repeated evaluations update the existing open/acknowledged incident instead of creating a new row each time. Occurrence counts and last-seen timestamps are retained.
- Operators can acknowledge or manually resolve active incidents.
- When a later evaluation finds that the triggering condition has cleared, the incident is automatically marked resolved with the `condition_cleared` reason.
- Disabling a rule resolves its active incident on the next evaluation. Re-triggering after resolution creates a new incident.
- Incidents are isolated by organization and indexed for status/severity/time-based queue views.

**Evaluation cadence and delivery limitations**
- This release exposes an authenticated evaluation endpoint and a **Run evaluation** action in the UI. Evaluation is on demand; there is not yet a built-in scheduler, worker queue, email/SMS/push delivery, escalation policy, or guaranteed real-time alert SLA.
- For periodic checks, an operator-controlled external scheduler can call the organization evaluation endpoint using a secure service identity. Do not expose user access tokens in cron logs or client-side code.
- High-consumption thresholds are raw energy totals for the configured window, not weather-normalized baselines, tariff peaks, or statistical anomaly scores. Meter/gateway silence uses the latest reading/delivery timestamps.
- This is operational decision support. It does not issue equipment commands or replace a safety-rated industrial alarm system.

### Continuous integration

GitHub Actions runs the backend Node.js test suite and Vue/TypeScript production build on pushes and pull requests targeting `main`. The workflow installs workspace dependencies with Node.js 22. A successful workflow is required before treating a change as build-verified.

### Tenant and role controls

Every facility, meter, and reading query is scoped to the organization resolved from the authenticated user's active membership. A meter can only be registered against a facility in that same organization. The organization ID in the URL is a lookup context, never proof of access.

Roles available: `owner`, `admin`, `operator`, `analyst`, and `viewer`. All members can read; only owner/admin/operator can create facilities, register meters, ingest readings, import CSV batches, or configure tariff versions. Owner/admin/operator/analyst can generate bill estimates and reconcile utility invoices; viewer is read-only.

## Architecture principles

1. **Tenant scope is mandatory:** tenant-owned reads and writes include the verified organization ID.
2. **No client-side trust:** roles and ownership are checked by the API.
3. **Idempotent ingestion:** event identifiers prevent duplicate readings on retries.
4. **Explainable intelligence:** future forecasts and recommendations will expose inputs, assumptions, constraints, and evaluation metrics.
5. **Safe-by-default operations:** initial product workflows simulate control actions; they do not directly operate physical industrial equipment.
6. **Authenticated telemetry:** generic gateway webhooks use timestamped HMAC signatures, encrypted-at-rest credentials, organization-scoped meter mappings, and idempotent event IDs.
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
10. Meter CSV batch ingestion, invoice reconciliation, encrypted gateway secrets, signed webhook telemetry, source freshness monitoring, and incident management — initial implementation complete; background scheduling, outbound notifications, and vendor protocol adapters remain.
11. Production hardening, observability, and integration testing.

## Security

Never commit real credentials, production connection strings, gateway signing secrets, the `INTEGRATION_ENCRYPTION_KEY`, private meter data, or customer information. Keep `.env` untracked. Configure a persistent random `INTEGRATION_ENCRYPTION_KEY` (at least 32 characters) before provisioning gateway sources; back it up securely because existing encrypted gateway secrets depend on it. Configure HTTPS and `COOKIE_SECURE=true` in production.

## License

No license has been selected yet. Until one is added, all rights are reserved by default.

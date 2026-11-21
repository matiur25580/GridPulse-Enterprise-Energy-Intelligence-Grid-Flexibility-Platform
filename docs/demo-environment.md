# GridPulse demonstration environment

This guide creates an isolated, repeatable demonstration tenant with synthetic energy telemetry. It is intended for local development, interviews, product walkthroughs, and screenshot generation—not production or utility settlement.

## Safety and provenance

- The seeder refuses to run when `NODE_ENV=production`.
- It writes only to the fixed demo organization with slug `gridpulse-demo` and the dedicated demo account email.
- It does not delete existing data. Re-running it upserts the organization, assets, tariffs, alert rule, incident, and readings by stable identifiers.
- Reading values are synthetic and use the `simulation` source. They are not customer, utility, or revenue-grade measurements.
- The seeded notification subscription is disabled and contains no recipients. No email is sent.
- Use a dedicated non-production MongoDB database. Never point the seeder at a production cluster.

## Local setup

1. Install dependencies and configure the normal GridPulse environment:

   ```bash
   npm install
   cp .env.example .env
   ```

2. Start a local MongoDB instance and set `MONGODB_URI` in `.env`. The demo seed path does not use registration transactions; normal registration still requires a replica set.

3. Supply a demo password in the shell. It must contain at least 12 characters, an uppercase letter, a lowercase letter, and a number:

   ```bash
   export DEMO_SEED_EMAIL=demo@gridpulse.local
   export DEMO_SEED_PASSWORD='Choose-A-Local-Demo-Password-2026'
   npm run seed:demo
   npm run dev
   ```

4. Open http://localhost:5173 and sign in with the demo email and the password you supplied.

## Seeded portfolio

The deterministic seed creates:

- One organization: **GridPulse Demonstration Portfolio**.
- Four India-based facilities in Kolkata, Pune, Bengaluru, and Hyderabad, all using the `Asia/Kolkata` timezone.
- Ten active meters across main incomers, HVAC submeters, and rooftop solar meters.
- Sixty days of hourly synthetic telemetry, with valid, estimated, and flagged quality examples.
- Four effective-dated INR time-of-use tariff plans with peak/off-peak energy rates, fixed charges, demand charges, and tax assumptions.
- One high-consumption alert rule and one acknowledged demonstration incident.
- An explicitly disabled email-notification subscription with no recipients.

The seed is additive and idempotent: stable external reading IDs prevent duplicate telemetry on repeated runs. It adds the latest 60-day window on each run, so the database can gain new hourly observations as time advances. The demo user is created only once; reruns do not reset an existing account password, so keep the original password or use a fresh dedicated demo database.

## Authentic browser screenshot capture

The dedicated GitHub Actions workflow at `.github/workflows/demo-gallery.yml` starts an ephemeral MongoDB service, seeds the demo tenant, launches the API and Vue app, signs in with the CI-only demo credentials, and captures twelve screenshots from the running application with Playwright Chromium.

- Trigger it by pushing a change to the demo/screenshot workflow paths or from **Actions → GridPulse demo gallery → Run workflow**.
- The workflow publishes `gridpulse-dashboard-screenshots` as a downloadable artifact for 14 days.
- Captures are genuine browser renders of the application backed by synthetic demo data. They are not hand-authored mockups or real customer data.
- The committed SVG gallery remains a lightweight visual fallback; it is clearly labelled as illustrative and is not misrepresented as a browser capture.
- The workflow does not commit generated binary screenshots back to `main`.

## Data cleanup

The seeder deliberately does not include a destructive cleanup command. To remove the demo tenant, use a dedicated non-production database and drop that database after confirming it contains no other development data.

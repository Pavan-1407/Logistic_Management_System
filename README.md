# Logistic Management System 

An interactive prototype of a full logistics/dispatch workflow, built to demo an end-to-end Logistic Management Operations : work order intake → rule-based auto-assignment → dispatcher approval (e-signature) → driver mobile app (pre-trip receipts, GPS tracking, proof of delivery) → business-analyst repeat-pickup loop → backend closure → multi-channel notifications → KPI / Finance / Revenue-Leakage dashboards.

Live logic, no backend required — all state is in-memory React state, seeded with sample data so every dashboard is populated on first load.

## Run it locally

```bash
git clone <this-repo-url>
cd Logistic_Management_System
npm install
npm run dev
```

Then open the URL Vite prints (typically `http://localhost:5173`).

## What's inside

- **Create Work Order** — customer intake with location free-text fallback, optional driver/truck/trailer preference
- **Dispatch & Approvals** — driver/truck/trailer roster with live status, manual assignment fallback, e-signature approval
- **Driver App** — mandatory weight-bridge + optional fuel receipt capture, GPS progress simulation, proof-of-delivery capture
- **Notifications** — simulated WhatsApp/SMS/Email log
- **KPI Dashboard** — utilization, delivery-time variance, trips-completed breakdowns
- **Finance** — weekly & monthly P&L, ride-level profit/loss table, truck-level ROI rollup, with charts
- **Revenue Leakage** — delayed-hours breakdown, assignment-delay risk tracking, driver idle-hours cost simulator

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Recharts (charts)
- lucide-react (icons)

## Notes

- All financial rates (driver pay, fuel cost, revenue per ride) are illustrative constants near the top of `src/App.jsx` (`RATES` object) — swap in real figures easily.
- No backend/database — this is a front-end-only prototype for demo purposes. A companion database schema design (for the production build) is described separately.

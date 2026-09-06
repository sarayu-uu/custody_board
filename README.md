# RoadShare

Shared Road Equipment Custody Board for the fictional Town A, Town B, Town C and Town D. All people, machines, reservations and incidents shown are demonstration data. The four towns jointly own the equipment; Town A is the central yard.

Live prototype: https://roadshare-app.onrender.com/

Town Admin represents the Town Supervisor in this prototype and provides the final safety clearance after a mechanic completes a repair.

## What it demonstrates

- Responsive reservation board with preserved preemptions and at-risk bookings
- Mandatory, receiving-crew-confirmed custody handoffs and printable receipt
- Emergency request, conflict impact preview and Town Admin approval
- Safety locks, mechanic repair completion and separate Town Admin clearance
- IndexedDB persistence, offline outbox, conflicts and resettable seed data
- Append-only, SHA-256 hash-linked local audit timeline
- Instant Crew Chief, Town Admin and Fleet Mechanic demo roles

## Architecture and setup

`frontend/` is React + TypeScript + Vite, React Router, React Hook Form, Zod, Zustand, Dexie and a PWA service worker. `backend/` is a stateless FastAPI validator; domain rules live in services, not routes.

```bash
npm --prefix frontend install
python -m pip install -r backend/requirements.txt
npm run api
npm run dev
```

Open `http://localhost:5173`; API docs are at `http://localhost:8000/docs`. Configure `frontend/.env` with `VITE_API_URL` and configure `ALLOWED_ORIGINS` for FastAPI.

## Verification

```bash
python -m pytest backend/tests
npm test
npm run typecheck
npm run build
```

## Offline behavior

The PWA caches its shell. Dexie keeps the last machine, schedule, maintenance and audit state. Offline submissions enter the outbox as `PENDING_SYNC`, not confirmed. Reconnection processes them in order. Rejected data remains on **Needs review** until explicitly discarded.

## Seeded journeys

Town A holds the grader with a Town D handoff due. Town C uses the low-fuel loader. The patcher is locked after a hydraulic repair and awaits Town Admin clearance. A Town D blocked-culvert request is pending, and an older booking remains visible as preempted.

## Deployment

Render: create a Web Service; build `pip install -r backend/requirements.txt`; start `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`; set `ALLOWED_ORIGINS`; verify `/api/health`.

Cloudflare Pages: root `frontend`; build `npm run build`; output `dist`; set `VITE_API_URL` to the Render origin and redeploy. Add verified desktop and 390×844 screenshots after deployment.

## Limitations

Role switching is not authentication. A stateless API cannot guarantee cross-client idempotency or authoritative shared state. Local audit hashes are tamper-evident, not tamper-proof. Evidence stays on-device. See [TRADEOFFS.md](TRADEOFFS.md) for the scale-up path.

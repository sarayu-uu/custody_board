# RoadShare submission

- Working prototype: https://roadshare-app.onrender.com/
- Public repository: https://github.com/sarayu-uu/custody_board

## 300-word summary: edge cases and UX trade-offs

RoadShare prioritizes fast, accountable equipment custody under unreliable rural connectivity. The prototype models four towns sharing three machines and begins with realistic available, maintenance, emergency, and historical records. Crew Chiefs can reserve equipment, complete handoffs, request urgent use, and report defects with photo proof. The shared Equipment Admin represents the Town Supervisor, approves emergencies, and provides final maintenance clearance. Fleet Mechanics diagnose defects, apply safety locks, and record completed repairs.

Strict rules protect the most disputed actions. Reservations cannot overlap. Maintenance-locked equipment cannot be reserved, handed over, or assigned to emergencies. Handoffs require fuel percentage, hour-meter reading, condition notes, checklist results, and receiving-crew confirmation. Readings cannot move backward. Emergency requests require justification; approval preserves displaced bookings as PREEMPTED, records the reason, and offers rescheduling. Repair completion does not release equipment until Equipment Admin clearance. Audit events are append-only and hash-linked locally.

Field speed influenced the interface. Large status cards, distinct equipment icons, written labels, strong contrast, short errors, fixed card order, and mobile drawers reduce interpretation time. The schedule supports hourly scanning, date navigation, history, and tap-for-details on narrow booking bars. Forms preserve drafts and local evidence. Offline actions enter Needs Review and retry after reconnection instead of pretending to be confirmed.

We deliberately did not build user accounts, GPS tracking, cloud uploads, SMS alerts, procurement, repair costing, or automated dispatch. These features would distract from custody, safety, and conflict handling during a short prototype build. The role switcher demonstrates authorization workflows but is not authentication. FastAPI validates submitted actions, while IndexedDB remains the prototype data store. Consequently, separate phones do not share an authoritative live database, and local audit hashes are tamper-evident rather than tamper-proof. This is appropriate for demonstrating workflows at zero cost, but production deployment requires centralized transactional storage, authenticated identities, durable evidence, and server-owned audit records.

## Scaling to 10× usage

At 10× usage, multiple crews will reserve the same machine from different phones, offline edits will reconnect out of order, attachments will consume device storage, and administrators will face more emergency decisions and notification work. Browser-only state would create different versions of the schedule on each device. A stateless validator cannot atomically prevent those cross-device conflicts.

The production architecture should make PostgreSQL the authoritative store. Reservation approval should run in a database transaction with exclusion constraints on machine and time range, row versions for optimistic concurrency, idempotency keys for retried offline operations, and server timestamps. FastAPI should authenticate users through OIDC and enforce town-scoped role permissions server-side. Evidence should move to encrypted S3-compatible object storage using signed uploads, retention rules, malware scanning, and checksums. Audit events should be server-owned, append-only, and exported to immutable retention storage.

WebSockets or server-sent events should push custody, lock, and booking changes to every connected phone. A background queue should handle SMS/email notifications, thumbnails, and retryable jobs. Offline clients should sync deltas from a server cursor and present explicit conflict resolution instead of overwriting records.

Operationally, define emergency priority levels, escalation timeouts, maintenance service targets, evidence-retention policy, and who pays when condition logs disagree. Add monitoring for failed syncs, booking conflicts, stale handoffs, low fuel, storage growth, API latency, and notification delivery. Backups, restore drills, rate limits, accessibility testing, and device/browser support become necessary before expanding beyond the four-town pilot.

## Prototype boundary

The current build demonstrates the required workflows and local real-time UI updates. It does not claim cross-device real-time consistency, production authentication, or centrally durable audit/evidence storage.

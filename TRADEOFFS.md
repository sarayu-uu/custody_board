# Trade-offs and decisions

Browser-local persistence was selected because rural field connectivity is unreliable and the challenge requires a zero-cost prototype. Dexie over IndexedDB keeps machine status, reservations, drafts, attachments and recent history available after refresh or network loss. IndexedDB is more suitable than `localStorage` for structured records, transactions and binary evidence.

FastAPI is intentionally stateless. The browser sends the action plus the relevant cached state; FastAPI validates role permissions, versions, scheduling conflicts and allowed transitions, then returns accepted changes and audit events. This keeps free-tier deployment simple. It cannot provide durable cross-request idempotency without server storage, so operation IDs are reliable within the local outbox but only best-effort across independent clients.

Offline actions remain `PENDING_SYNC` rather than appearing confirmed. A locally entered reservation may conflict with work created elsewhere, or a machine may have changed custodian or entered maintenance. On reconnection, operations are processed in creation order. Rejected data is retained as `CONFLICT` or `FAILED_VALIDATION`; there is no force-accept control.

Emergency priority never overrides a maintenance lock because public urgency does not make unsafe equipment operable. An approved emergency marks overlapping reservations `PREEMPTED`, preserves their original details, creates an emergency booking, and still requires physical custody transfer.

Audit events are append-only in the interface and linked with browser-generated SHA-256 hashes. This makes local alteration evident, not impossible. The demo role switcher is a testing convenience rather than authentication, so it must not be mistaken for production authorization.

Cross-device synchronization was deliberately excluded. At larger scale, PostgreSQL would become authoritative, with FastAPI transactions, Alembic migrations, OIDC authentication, town-scoped RBAC, S3-compatible evidence storage, server timestamps, append-only server audit records and optimistic versions. The offline outbox would remain, while WebSockets or server-sent events would refresh schedules. Background workers would only be introduced for notifications or file processing.

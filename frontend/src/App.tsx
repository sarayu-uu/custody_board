import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  Construction,
  FileClock,
  Fuel,
  Gauge,
  History,
  LockKeyhole,
  Menu,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  Truck,
  Tractor,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { db } from "./db/database";
import { useUI } from "./stores/ui";
import { queueOrValidate, syncPending } from "./services/api";
import type {
  Emergency,
  Machine,
  Maintenance,
  PendingOperation,
  Reservation,
  Role,
  Town,
} from "./types";

const nav = [
  ["/", "Board", Truck],
  ["/schedule", "Schedule", CalendarDays],
  ["/handoffs", "Handoffs", ClipboardCheck],
  ["/urgent", "Urgent use", ShieldAlert],
  ["/maintenance", "Maintenance", Wrench],
  ["/audit", "Audit", History],
  ["/conflicts", "Needs review", FileClock],
] as const;
const labels: Record<Role, string> = {
  CREW_CHIEF: "Crew Chief",
  TOWN_ADMIN: "Town Admin",
  FLEET_MECHANIC: "Fleet Mechanic",
};
const neutralTownNames: Record<string, { name: string; shortName: string }> = {
  mangalparthy: { name: "Town A", shortName: "A" },
  jalalpur: { name: "Town B", shortName: "B" },
  manepalle: { name: "Town C", shortName: "C" },
  kuknoor: { name: "Town D", shortName: "D" },
};
function neutralTown(town: Town): Town {
  return { ...town, ...(neutralTownNames[town.id] || {}) };
}
function neutralPlace(value: string | undefined): string {
  return String(value || "")
    .replace(/mannervar jalalpur/gi, "Town B")
    .replace(/mannevar jalalpur/gi, "Town B")
    .replace(/m\.\s*jalalpur/gi, "Town B")
    .replace(/jalalpur/gi, "Town B")
    .replace(/mangalparthy/gi, "Town A")
    .replace(/manepalle/gi, "Town C")
    .replace(/kuknoor/gi, "Town D");
}
export default function App() {
  const { role, townId, setRole, setTown, offlineTest, setOfflineTest } =
    useUI();
  const storedTowns = useLiveQuery(() => db.towns.toArray(), []) || [];
  const towns = storedTowns.map(neutralTown);
  const meta = useLiveQuery(() => db.appMetadata.get("sync"), []);
  const pending =
    useLiveQuery(
      () =>
        db.pendingOperations
          .where("status")
          .anyOf("PENDING_SYNC", "CONFLICT", "FAILED_VALIDATION")
          .count(),
      [],
    ) || 0;
  const [menu, setMenu] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const online = browserOnline && !offlineTest;
  useEffect(() => {
    const go = () => {
      setBrowserOnline(true);
      syncPending();
    };
    const stop = () => setBrowserOnline(false);
    window.addEventListener("online", go);
    window.addEventListener("offline", stop);
    return () => {
      window.removeEventListener("online", go);
      window.removeEventListener("offline", stop);
    };
  }, []);
  return (
    <div className="app">
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          <span>
            <Truck />
          </span>
          <div>
            <b>ROADSHARE</b>
            <small>SHARED EQUIPMENT</small>
          </div>
          <button onClick={() => setMenu(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([to, text, I]) => (
            <NavLink key={to} to={to} onClick={() => setMenu(false)}>
              <I />
              <span>{text}</span>
              {to === "/conflicts" && pending > 0 && <i>{pending}</i>}
            </NavLink>
          ))}
        </nav>
        <div className="sidefoot">
          <button onClick={() => setOfflineTest(!offlineTest)}>
            <CloudOff /> Offline test: {offlineTest ? "ON" : "OFF"}
          </button>
          <button onClick={() => db.resetDemo()}>
            <RefreshCw /> Reset Demo Data
          </button>
          <small>Fictional demonstration data</small>
        </div>
      </aside>
      <main>
        <header>
          <button className="menubtn" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="headtitle">
            <b>RoadShare</b>
            <span>FICTIONAL TOWN A–D DEMO</span>
          </div>
          <div className={"connect " + (online ? "online" : "offline")}>
            <i />
            {online ? "Online" : "Offline"}
            <small>
              {online ? "Synced" : "Last saved"}{" "}
              {meta?.lastSynchronizedAt
                ? format(
                    new Date(String(meta.lastSynchronizedAt)),
                    "d MMM, h:mm a",
                  )
                : "—"}
            </small>
          </div>
          <div className="switchers">
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {Object.entries(labels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              aria-label="Town"
              value={townId}
              onChange={(e) => setTown(e.target.value)}
            >
              {towns.map((t) => (
                <option value={t.id} key={t.id}>
                  View: {t.name}
                </option>
              ))}
            </select>
          </div>
        </header>
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/handoffs" element={<Handoffs />} />
            <Route path="/urgent" element={<Urgent />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/machine/:id" element={<Dashboard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
function Head({
  over,
  title,
  sub,
  action,
}: {
  over: string;
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="pagehead">
      <div>
        <span>{over}</span>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}
function useCore() {
  return {
    machines: useLiveQuery(() => db.machines.toArray(), []) || [],
    towns: (useLiveQuery(() => db.towns.toArray(), []) || []).map(neutralTown),
    reservations: useLiveQuery(() => db.reservations.toArray(), []) || [],
    handoffs: useLiveQuery(() => db.handoffs.toArray(), []) || [],
    emergencies: useLiveQuery(() => db.emergencyRequests.toArray(), []) || [],
    maintenance: useLiveQuery(() => db.maintenanceRecords.toArray(), []) || [],
  };
}
function Dashboard() {
  const d = useCore();
  const { role, townId } = useUI();
  const nav = useNavigate();
  const attention = [
    ...d.handoffs
      .filter((h) => h.status === "PENDING")
      .map((h) => ({
        kind: "Handoff due",
        text: d.machines.find((m) => m.id === h.machineId)?.name || "",
        to: "/handoffs",
      })),
    ...d.emergencies
      .filter((e) => e.status === "PENDING" && role === "TOWN_ADMIN")
      .map((e) => ({
        kind: "Urgent request",
        text: d.towns.find((t) => t.id === e.requestingTownId)?.name || "",
        to: "/urgent",
      })),
    ...d.maintenance
      .filter(
        (m) =>
          m.status === "REPAIRED_AWAITING_CLEARANCE" && role === "TOWN_ADMIN",
      )
      .map((m) => ({
        kind: "Clear for use",
        text: d.machines.find((x) => x.id === m.machineId)?.name || "",
        to: "/maintenance",
      })),
    ...d.machines
      .filter((m) => m.fuelPercentage < 25)
      .map((m) => ({
        kind: "Low fuel",
        text: `${m.name} · ${m.fuelPercentage}%`,
        to: "/",
      })),
  ];
  return (
    <>
      <Head
        over="JOINTLY OWNED EQUIPMENT · FICTIONAL DEMO"
        title={`${d.towns.find((t) => t.id === townId)?.name || "Town"} view`}
        sub="See this town's equipment, bookings and the location of the shared fleet."
      />
      <section className="attention">
        <div className="sectitle">
          <h2>Attention needed</h2>
          <span>{attention.length} ACTIONS</span>
        </div>
        <div className="attentiongrid">
          {attention.map((a, i) => (
            <button key={i} onClick={() => nav(a.to)}>
              <AlertTriangle />
              <span>
                <b>{a.kind}</b>
                <small>{a.text}</small>
              </span>
              <ArrowRight />
            </button>
          ))}
        </div>
      </section>
      <div className="sectionlabel">
        <h2>Fleet status</h2>
        <span>Equipment held by the selected town appears first.</span>
      </div>
      <div className="machinegrid">
        {[...d.machines]
          .sort((a, b) =>
            a.currentCustodianId === townId
              ? -1
              : b.currentCustodianId === townId
                ? 1
                : 0,
          )
          .map((m) => (
            <MachineCard
              key={m.id}
              m={m}
              towns={d.towns}
              reservations={d.reservations}
              role={role}
              townId={townId}
            />
          ))}
      </div>
    </>
  );
}
function MachineGlyph({ type }: { type: string }) {
  const identity = String(type || "").toLowerCase();
  if (identity.includes("grader") || identity.includes("gr-"))
    return (
      <span className="machineglyph grader" title="Motor grader">
        <Construction />
      </span>
    );
  if (
    identity.includes("loader") ||
    identity.includes("backhoe") ||
    identity.includes("bl-")
  )
    return (
      <span className="machineglyph loader" title="Backhoe loader">
        <Tractor />
      </span>
    );
  return (
    <span className="machineglyph patcher" title="Pothole patcher">
      <Truck />
    </span>
  );
}
function MachineCard({
  m,
  towns,
  reservations,
  role,
  townId,
}: {
  m: Machine;
  towns: Town[];
  reservations: Reservation[];
  role: Role;
  townId: string;
}) {
  const nav = useNavigate();
  const cust = towns.find((t) => t.id === m.currentCustodianId);
  const list = reservations
    .filter(
      (r) =>
        r.machineId === m.id && !["CANCELLED", "COMPLETED"].includes(r.status),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const current = list.find((r) => r.status === "ACTIVE"),
    next = list.find((r) => ["UPCOMING", "AT_RISK"].includes(r.status));
  let action = "View schedule",
    to = "/schedule";
  if (
    role === "CREW_CHIEF" &&
    m.currentCustodianId === townId &&
    m.status !== "MAINTENANCE_LOCKED"
  ) {
    action = "Start handoff";
    to = "/handoffs";
  } else if (role === "CREW_CHIEF" && m.status === "AVAILABLE") {
    action = "Reserve";
    to = "/schedule";
  } else if (role === "FLEET_MECHANIC" && m.status === "MAINTENANCE_LOCKED") {
    action = "Record repair";
    to = "/maintenance";
  } else if (role === "TOWN_ADMIN" && m.status === "MAINTENANCE_LOCKED") {
    action = "Review repair";
    to = "/maintenance";
  }
  return (
    <article
      className={
        "machine " + (m.status === "MAINTENANCE_LOCKED" ? "locked" : "")
      }
    >
      <div className="machinehead">
        <span>{m.id}</span>
        <Status value={m.status} />
      </div>
      <div className="machinetitle">
        <MachineGlyph type={`${m.id} ${m.type || ""} ${m.name}`} />
        <h2>{m.name}</h2>
      </div>
      <p className="owner">Joint owner: Town A–D Shared Equipment Pool</p>
      {m.status === "MAINTENANCE_LOCKED" && (
        <div className="lockbanner">
          <LockKeyhole />
          <b>Under repair</b>
          <span>{m.lastConditionSummary}</span>
        </div>
      )}
      <div className="facts">
        <div>
          <span>WHO HAS IT</span>
          <b>{cust?.name}</b>
        </div>
        <div>
          <span>WHERE IT IS</span>
          <b>
            <MapPin />
            {cust?.name} Yard
          </b>
        </div>
      </div>
      <div className="meters">
        <span>
          <Fuel /> Fuel <b>{m.fuelPercentage}%</b>
        </span>
        <span>
          <Gauge /> Hours <b>{m.hourMeter.toFixed(1)}</b>
        </span>
      </div>
      <div className="bookings">
        <BookingLine label="CURRENT BOOKING" r={current} towns={towns} />
        <BookingLine label="NEXT BOOKING" r={next} towns={towns} />
      </div>
      <button className="primary" onClick={() => nav(to)}>
        {action}
        <ArrowRight />
      </button>
      <div className="cardquick">
        <button onClick={() => nav("/schedule")}>
          <CalendarDays /> Schedule
        </button>
        {role === "CREW_CHIEF" && m.status !== "MAINTENANCE_LOCKED" && (
          <button onClick={() => nav("/maintenance")}>
            <Wrench /> Report problem
          </button>
        )}
        {role === "CREW_CHIEF" && (
          <button onClick={() => nav("/urgent")}>
            <ShieldAlert /> Urgent use
          </button>
        )}
        {role !== "CREW_CHIEF" && (
          <button onClick={() => nav("/maintenance")}>
            <Wrench /> Maintenance
          </button>
        )}
      </div>
    </article>
  );
}
function BookingLine({
  label,
  r,
  towns,
}: {
  label: string;
  r?: Reservation;
  towns: Town[];
}) {
  return (
    <div>
      <span>{label}</span>
      {r ? (
        <>
          <b>{towns.find((t) => t.id === r.townId)?.name}</b>
          <small>
            {format(new Date(r.startAt), "d MMM, h:mm a")} ·{" "}
            {r.status.replace("_", " ")}
          </small>
        </>
      ) : (
        <b>None</b>
      )}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value.toLowerCase()}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Schedule() {
  const d = useCore();
  const { role, townId } = useUI();
  const [modal, setModal] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  return (
    <>
      <Head
        over="HOURLY RESERVATION BOARD"
        title="Equipment schedule"
        sub="Each row is a machine. Booking bars show which town has it during each hour."
        action={
          role !== "FLEET_MECHANIC" && (
            <button className="primary" onClick={() => setModal(true)}>
              <Plus />
              Reserve
            </button>
          )
        }
      />
      <div className="scheduletools">
        <span>Current, upcoming and previous equipment use</span>
        <label>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />{" "}
          Previous history
        </label>
      </div>
      <HourlySchedule
        data={d}
        selectedTownId={townId}
        showHistory={showHistory}
      />
      <section className="schedule legacy-schedule">
        {d.machines.map((m) => (
          <div className="schedulerow" key={m.id}>
            <div>
              <b>{m.name}</b>
              <small>{m.id}</small>
            </div>
            <div className="bookingblocks">
              {d.reservations
                .filter((r) => r.machineId === m.id)
                .map((r) => (
                  <article key={r.id} className={r.status.toLowerCase()}>
                    <span>{d.towns.find((t) => t.id === r.townId)?.name}</span>
                    <b>{format(new Date(r.startAt), "d MMM, h:mm a")}</b>
                    <small>
                      {neutralPlace(r.workLocation)} · {r.purpose}
                    </small>
                    <Status value={r.status} />
                    {r.status === "PREEMPTED" && (
                      <em>Original booking preserved</em>
                    )}
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
      {modal && <ReservationForm close={() => setModal(false)} data={d} />}
    </>
  );
}
function TownSchedule({
  data,
  selectedTownId,
  showHistory,
}: {
  data: ReturnType<typeof useCore>;
  selectedTownId: string;
  showHistory: boolean;
}) {
  return (
    <section className="schedule townschedule">
      {data.towns.map((town) => {
        const bookings = data.reservations
          .filter(
            (r) =>
              r.townId === town.id && (showHistory || r.status !== "COMPLETED"),
          )
          .sort((a, b) => a.startAt.localeCompare(b.startAt));
        return (
          <div
            className={
              "schedulerow " +
              (town.id === selectedTownId ? "selectedtown" : "")
            }
            key={town.id}
          >
            <div className="townrowlabel" style={{ borderColor: town.color }}>
              <span className="townletter" style={{ background: town.color }}>
                {town.shortName}
              </span>
              <b>{town.name}</b>
              <small>{bookings.length} records</small>
            </div>
            <div className="bookingblocks">
              {bookings.length ? (
                bookings.map((r) => {
                  const machine = data.machines.find(
                    (m) => m.id === r.machineId,
                  )!;
                  return (
                    <article key={r.id} className={r.status.toLowerCase()}>
                      <div className="bookingmachine">
                        <MachineGlyph
                          type={`${machine.id} ${machine.type || ""} ${machine.name}`}
                        />
                        <span>{machine.name}</span>
                      </div>
                      <b>{format(new Date(r.startAt), "d MMM yyyy")}</b>
                      <strong>
                        {format(new Date(r.startAt), "h:mm a")} –{" "}
                        {format(new Date(r.endAt), "h:mm a")}
                      </strong>
                      <small>
                        {neutralPlace(r.workLocation)} · {r.purpose}
                      </small>
                      <Status value={r.status} />
                      {r.status === "PREEMPTED" && (
                        <em>Original booking preserved</em>
                      )}
                    </article>
                  );
                })
              ) : (
                <div className="noschedule">No equipment use recorded</div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
function HourlySchedule({
  data,
  showHistory,
}: {
  data: ReturnType<typeof useCore>;
  selectedTownId: string;
  showHistory: boolean;
}) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 6),
    boardDay = "2026-09-05";
  const today = data.reservations.filter((r) => r.startAt.startsWith(boardDay));
  const history = data.reservations
    .filter((r) => r.status === "COMPLETED")
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
  return (
    <>
      <section className="hourboard">
        <div className="hourcorner">
          <b>Saturday, 5 Sep</b>
          <small>Machine</small>
        </div>
        <div className="hourheaders">
          {hours.map((h) => (
            <span key={h}>
              {h > 12 ? h - 12 : h}
              <small>{h >= 12 ? "PM" : "AM"}</small>
            </span>
          ))}
        </div>
        {data.machines.map((machine) => (
          <div className="hourrow" key={machine.id}>
            <div className="hourmachine">
              <MachineGlyph
                type={`${machine.id} ${machine.type || ""} ${machine.name}`}
              />
              <span>
                <b>{machine.name}</b>
                <small>{machine.id}</small>
              </span>
            </div>
            <div className="hourtrack">
              {hours.map((h) => (
                <i key={h} />
              ))}
              {today
                .filter((r) => r.machineId === machine.id)
                .map((r) => {
                  const start = new Date(r.startAt),
                    end = new Date(r.endAt),
                    sv = start.getHours() + start.getMinutes() / 60,
                    ev = end.getHours() + end.getMinutes() / 60,
                    left = Math.max(0, ((sv - 6) / 12) * 100),
                    width = Math.max(
                      4,
                      ((Math.min(18, ev) - Math.max(6, sv)) / 12) * 100,
                    ),
                    town = data.towns.find((t) => t.id === r.townId)!;
                  return (
                    <div
                      className="hourbooking"
                      key={r.id}
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: town.color,
                      }}
                    >
                      <b>{town.name}</b>
                      <span>
                        {format(start, "h:mm a")} – {format(end, "h:mm a")}
                      </span>
                      <small>{r.purpose}</small>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </section>
      {showHistory && (
        <section className="usagehistory">
          <div className="sectitle">
            <h2>Previous equipment use</h2>
            <span>DUMMY HISTORY</span>
          </div>
          <div className="historygrid">
            {history.map((r) => {
              const machine = data.machines.find((m) => m.id === r.machineId)!,
                town = data.towns.find((t) => t.id === r.townId)!;
              return (
                <article key={r.id} style={{ borderColor: town.color }}>
                  <MachineGlyph
                    type={`${machine.id} ${machine.type || ""} ${machine.name}`}
                  />
                  <div>
                    <b>
                      {machine.name} · {town.name}
                    </b>
                    <strong>
                      {format(new Date(r.startAt), "d MMM yyyy")} ·{" "}
                      {format(new Date(r.startAt), "h:mm a")} –{" "}
                      {format(new Date(r.endAt), "h:mm a")}
                    </strong>
                    <small>
                      {neutralPlace(r.workLocation)} · {r.purpose}
                    </small>
                  </div>
                  <Status value={r.status} />
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
const reservationSchema = z
  .object({
    machineId: z.string(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    workLocation: z.string().min(2),
    purpose: z.string().min(2),
  })
  .refine((v) => new Date(v.startAt) < new Date(v.endAt), {
    message: "End must be after start",
    path: ["endAt"],
  });
function ReservationForm({
  close,
  data,
}: {
  close: () => void;
  data: ReturnType<typeof useCore>;
}) {
  const { role, townId } = useUI();
  const [message, setMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      machineId: "MDK-GR-01",
      startAt: "2026-09-09T08:00",
      endAt: "2026-09-09T16:00",
      workLocation: "",
      purpose: "",
    },
  });
  const onSubmit = async (v: z.infer<typeof reservationSchema>) => {
    const m = data.machines.find((x) => x.id === v.machineId)!;
    const id = crypto.randomUUID();
    const op = makeOp(
      "reservation",
      id,
      m.version,
      { ...v, machineId: m.id, townId, version: 1 },
      { machine: m, reservations: data.reservations },
      role,
      townId,
    );
    try {
      const out = await queueOrValidate(op);
      setMessage(
        out.queued ? "Waiting for connection" : "Reservation confirmed",
      );
      if (!out.queued) setTimeout(close, 700);
    } catch (e: any) {
      setMessage(e.message || "Needs review");
    }
  };
  return (
    <Modal title="Reserve equipment" close={close}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <label>
          Machine
          <select {...register("machineId")}>
            {data.machines.map((m) => (
              <option
                value={m.id}
                key={m.id}
                disabled={m.status === "MAINTENANCE_LOCKED"}
              >
                {m.name}
                {m.status === "MAINTENANCE_LOCKED" ? " — Under repair" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="twocol">
          <Field label="Start" error={errors.startAt?.message}>
            <input type="datetime-local" {...register("startAt")} />
          </Field>
          <Field label="End" error={errors.endAt?.message}>
            <input type="datetime-local" {...register("endAt")} />
          </Field>
        </div>
        <Field label="Work location" error={errors.workLocation?.message}>
          <input
            {...register("workLocation")}
            placeholder="Road, ward or landmark"
          />
        </Field>
        <Field label="Work purpose" error={errors.purpose?.message}>
          <textarea
            {...register("purpose")}
            placeholder="What work needs the machine?"
          />
        </Field>
        {message && <Notice text={message} />}
        <button className="primary sticky">Check and reserve</button>
      </form>
    </Modal>
  );
}
function Handoffs() {
  const d = useCore();
  const { role, townId } = useUI();
  const [chosen, setChosen] = useState<Machine>();
  const eligible = d.machines.filter(
    (m) => m.currentCustodianId === townId && m.status !== "MAINTENANCE_LOCKED",
  );
  return (
    <>
      <Head
        over="CUSTODY TRANSFER"
        title="Handoffs"
        sub="Inspect, record condition, then ask the receiving crew to confirm."
      />
      <div className="stepper">
        <b>1 Machine</b>
        <i />
        <b>2 Readings</b>
        <i />
        <b>3 Condition</b>
        <i />
        <b>4 Confirm</b>
      </div>
      {role !== "CREW_CHIEF" ? (
        <Empty text="Switch to Crew Chief to transfer or accept a machine." />
      ) : (
        <div className="actioncards">
          {eligible.map((m) => (
            <button key={m.id} onClick={() => setChosen(m)}>
              <Truck />
              <span>
                <b>{m.name}</b>
                <small>{m.id} · You currently have it</small>
              </span>
              <ArrowRight />
            </button>
          ))}
          {eligible.length === 0 && (
            <Empty text="Your town has no machine ready for outgoing handoff." />
          )}
        </div>
      )}
      {chosen && (
        <HandoffForm
          machine={chosen}
          data={d}
          close={() => setChosen(undefined)}
        />
      )}
    </>
  );
}
const checks = [
  "Tyres or tracks",
  "Hydraulic leaks",
  "Lights and indicators",
  "Attachments present",
  "Visible body damage",
  "General cleanliness",
];
const handoffSchema = z.object({
  receivingTownId: z.string(),
  physicalLocation: z.string().min(2),
  fuelPercentage: z.coerce.number().min(0).max(100),
  hourMeter: z.coerce.number(),
  conditionNotes: z.string().min(2),
  receivingConfirmed: z.literal(true),
  checks: z.record(z.string(), z.enum(["Good", "Watch", "Problem"])),
});
function HandoffForm({
  machine,
  data,
  close,
}: {
  machine: Machine;
  data: ReturnType<typeof useCore>;
  close: () => void;
}) {
  const { role, townId } = useUI();
  const [msg, setMsg] = useState("");
  const [receipt, setReceipt] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(handoffSchema),
    defaultValues: {
      receivingTownId: data.towns.find((t) => t.id !== townId)?.id,
      physicalLocation: "",
      fuelPercentage: machine.fuelPercentage,
      hourMeter: machine.hourMeter,
      conditionNotes: "",
      receivingConfirmed: false as true,
      checks: Object.fromEntries(checks.map((c) => [c, "Good"])) as Record<
        string,
        "Good"
      >,
    },
  });
  const go = async (v: any) => {
    const pendingHandoff = data.handoffs.find(
      (handoff) =>
        handoff.machineId === machine.id && handoff.status === "PENDING",
    );
    const id = pendingHandoff?.id || crypto.randomUUID();
    const op = makeOp(
      "handoff",
      id,
      machine.version,
      { ...v, machineId: machine.id, sendingTownId: townId, attachmentIds: [] },
      { machine, reservations: data.reservations, handoff: pendingHandoff },
      role,
      townId,
    );
    try {
      const out = await queueOrValidate(op);
      if (out.queued) setMsg("Saved on this device · Waiting for connection");
      else setReceipt(true);
    } catch (e: any) {
      setMsg(e.message || "Needs review");
    }
  };
  if (receipt)
    return (
      <Modal title="Custody receipt" close={close}>
        <div className="receipt">
          <CheckCircle2 />
          <h2>Machine accepted</h2>
          <p>
            {machine.name} custody was transferred and the condition record was
            sealed.
          </p>
          <b>{new Date().toLocaleString()}</b>
          <button className="primary" onClick={() => print()}>
            Print receipt
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal title="Complete handoff" close={close}>
      <form onSubmit={handleSubmit(go)}>
        <label>
          Receiving town
          <select {...register("receivingTownId")}>
            {data.towns
              .filter((t) => t.id !== townId)
              .map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <Field
          label="Where is it going?"
          error={errors.physicalLocation?.message}
        >
          <input {...register("physicalLocation")} />
        </Field>
        <div className="twocol">
          <Field label="Fuel %" error={errors.fuelPercentage?.message}>
            <input
              className="number"
              type="number"
              {...register("fuelPercentage")}
            />
          </Field>
          <Field label="Hour meter" error={errors.hourMeter?.message}>
            <input
              className="number"
              type="number"
              step=".1"
              min={machine.hourMeter}
              {...register("hourMeter")}
            />
          </Field>
        </div>
        <div className="checklist">
          <b>Condition check</b>
          {checks.map((c) => (
            <label key={c}>
              {c}
              <select {...register(`checks.${c}`)}>
                <option>Good</option>
                <option>Watch</option>
                <option>Problem</option>
              </select>
            </label>
          ))}
        </div>
        <Field label="Condition notes" error={errors.conditionNotes?.message}>
          <textarea
            {...register("conditionNotes")}
            placeholder="Note any damage, wear or write ‘No new problems’."
          />
        </Field>
        <label className="upload">
          <Upload /> Add local photos
          <input type="file" multiple />
        </label>
        <label className="confirm">
          <input type="checkbox" {...register("receivingConfirmed")} />
          <span>
            <b>Receiving crew confirms custody</b>
            <small>
              I inspected and accept this machine and recorded condition.
            </small>
          </span>
        </label>
        {errors.receivingConfirmed && (
          <em className="error">Receiving confirmation is required</em>
        )}
        {msg && <Notice text={msg} />}
        <button className="primary sticky">Accept machine</button>
      </form>
    </Modal>
  );
}
function Urgent() {
  const d = useCore();
  const { role, townId } = useUI();
  const [modal, setModal] = useState(false);
  return (
    <>
      <Head
        over="EMERGENCY PRIORITY"
        title="Urgent use"
        sub="Urgent work can displace a booking, but never a maintenance lock."
        action={
          role === "CREW_CHIEF" && (
            <button className="danger" onClick={() => setModal(true)}>
              <ShieldAlert />
              Request urgent use
            </button>
          )
        }
      />
      <div className="requestlist">
        {d.emergencies.map((e) => (
          <EmergencyCard key={e.id} e={e} data={d} />
        ))}
      </div>
      {modal && <EmergencyForm data={d} close={() => setModal(false)} />}
    </>
  );
}
function EmergencyCard({
  e,
  data,
}: {
  e: Emergency;
  data: ReturnType<typeof useCore>;
}) {
  const { role, townId } = useUI();
  const [msg, setMsg] = useState("");
  const m = data.machines.find((x) => x.id === e.machineId)!;
  const conflict = data.reservations.find(
    (r) => r.id === e.conflictingReservationId,
  );
  const decide = async (decision: "APPROVED" | "REJECTED") => {
    const op = makeOp(
      "emergency-decision",
      e.id,
      m.version,
      { ...e, decision },
      { machine: m, reservations: data.reservations },
      role,
      townId,
    );
    try {
      await queueOrValidate(op);
      setMsg("Decision synced");
    } catch (x: any) {
      setMsg(x.message || "Needs review");
    }
  };
  return (
    <article className="request">
      <ShieldAlert />
      <div>
        <Status value={e.status} />
        <h2>{e.category}</h2>
        <p>{e.justification}</p>
        <span>
          {data.towns.find((t) => t.id === e.requestingTownId)?.name} ·{" "}
          {neutralPlace(e.affectedLocation)}
        </span>
        {conflict && (
          <div className="impact">
            <b>Would displace</b>
            {data.towns.find((t) => t.id === conflict.townId)?.name} ·{" "}
            {conflict.purpose}
          </div>
        )}
        {msg && <Notice text={msg} />}
      </div>
      {e.status === "PENDING" && role === "TOWN_ADMIN" && (
        <div className="actions">
          <button onClick={() => decide("REJECTED")}>Reject</button>
          <button className="danger" onClick={() => decide("APPROVED")}>
            Approve
          </button>
        </div>
      )}
    </article>
  );
}
const emergencySchema = z
  .object({
    machineId: z.string(),
    category: z.string(),
    startAt: z.string(),
    endAt: z.string(),
    affectedLocation: z.string().min(2),
    justification: z.string().min(10),
  })
  .refine((v) => new Date(v.startAt) < new Date(v.endAt), {
    message: "End must be after start",
    path: ["endAt"],
  });
function EmergencyForm({
  data,
  close,
}: {
  data: ReturnType<typeof useCore>;
  close: () => void;
}) {
  const { role, townId } = useUI();
  const [msg, setMsg] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(emergencySchema),
    defaultValues: {
      machineId: "MDK-GR-01",
      category: "Blocked culvert",
      startAt: "2026-09-06T06:00",
      endAt: "2026-09-06T16:00",
      affectedLocation: "",
      justification: "",
    },
  });
  const v = watch();
  const conflicts = data.reservations.filter(
    (r) =>
      r.machineId === v.machineId &&
      !["PREEMPTED", "CANCELLED", "COMPLETED"].includes(r.status) &&
      new Date(v.startAt) < new Date(r.endAt) &&
      new Date(v.endAt) > new Date(r.startAt),
  );
  const go = async (p: any) => {
    const m = data.machines.find((x) => x.id === p.machineId)!;
    try {
      const out = await queueOrValidate(
        makeOp(
          "emergency-request",
          crypto.randomUUID(),
          m.version,
          p,
          { machine: m, reservations: data.reservations },
          role,
          townId,
        ),
      );
      setMsg(
        out.queued
          ? "Saved on this device · Waiting for connection"
          : "Request sent",
      );
    } catch (e: any) {
      setMsg(e.message || "Needs review");
    }
  };
  return (
    <Modal title="Request urgent use" close={close}>
      <form onSubmit={handleSubmit(go)}>
        <label>
          Machine
          <select {...register("machineId")}>
            {data.machines.map((m) => (
              <option
                value={m.id}
                disabled={m.status === "MAINTENANCE_LOCKED"}
                key={m.id}
              >
                {m.name}
                {m.status === "MAINTENANCE_LOCKED" ? " — Under repair" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Emergency
          <select {...register("category")}>
            {[
              "Flooded road",
              "Blocked culvert",
              "Fallen tree",
              "Washed-out shoulder",
              "Emergency ambulance access",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div className="twocol">
          <label>
            Start
            <input type="datetime-local" {...register("startAt")} />
          </label>
          <label>
            End
            <input type="datetime-local" {...register("endAt")} />
          </label>
        </div>
        <Field
          label="Affected location"
          error={errors.affectedLocation?.message}
        >
          <input {...register("affectedLocation")} />
        </Field>
        <Field label="Why is it urgent?" error={errors.justification?.message}>
          <textarea {...register("justification")} />
        </Field>
        {conflicts.length > 0 && (
          <div className="impact">
            <b>{conflicts.length} booking will be affected</b>
            {conflicts.map((c) => (
              <span key={c.id}>
                {data.towns.find((t) => t.id === c.townId)?.name} · {c.purpose}
              </span>
            ))}
          </div>
        )}
        <label className="upload">
          <Upload /> Add local evidence
          <input type="file" />
        </label>
        {msg && <Notice text={msg} />}
        <button className="danger sticky">Send for Town Admin review</button>
      </form>
    </Modal>
  );
}
function MaintenancePage() {
  const d = useCore();
  const { role, townId } = useUI();
  const [chosen, setChosen] = useState<Maintenance>();
  const [report, setReport] = useState(false);
  const activeMaintenance = Object.values(
    d.maintenance
      .filter((record) => record.status !== "CLEARED")
      .reduce<Record<string, Maintenance>>((records, record) => {
        const current = records[record.machineId];
        const priority = (status: Maintenance["status"]) =>
          status === "REPAIRED_AWAITING_CLEARANCE"
            ? 3
            : status === "REPAIR_IN_PROGRESS"
              ? 2
              : status === "LOCKED"
                ? 1
                : 0;
        if (!current || priority(record.status) >= priority(current.status))
          records[record.machineId] = record;
        return records;
      }, {}),
  );
  return (
    <>
      <Head
        over="SAFETY & REPAIRS"
        title="Maintenance"
        sub="A safety lock stops every booking, urgent request and handoff."
        action={
          (role === "CREW_CHIEF" || role === "FLEET_MECHANIC") && (
            <button className="danger" onClick={() => setReport(true)}>
              <Plus />
              Report problem
            </button>
          )
        }
      />
      <div className="maintenance">
        {activeMaintenance.map((r) => {
          const m = d.machines.find((x) => x.id === r.machineId)!;
          return (
            <article key={r.id}>
              <LockKeyhole />
              <div>
                <Status value={r.status} />
                <h2>{m.name}</h2>
                <p>
                  {r.category} · {r.notes}
                </p>
                <small>
                  {r.status === "REPAIRED_AWAITING_CLEARANCE"
                    ? "Repair complete. Town Admin must clear for use."
                    : "Future bookings are marked at risk."}
                </small>
              </div>
              {((role === "FLEET_MECHANIC" && r.status === "LOCKED") ||
                (role === "TOWN_ADMIN" &&
                  r.status === "REPAIRED_AWAITING_CLEARANCE")) && (
                <button className="primary" onClick={() => setChosen(r)}>
                  {role === "TOWN_ADMIN" ? "Clear for use" : "Record repair"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {report && <DefectForm data={d} close={() => setReport(false)} />}{" "}
      {chosen && (
        <RepairForm
          record={chosen}
          data={d}
          close={() => setChosen(undefined)}
        />
      )}
    </>
  );
}
function DefectForm({
  data,
  close,
}: {
  data: ReturnType<typeof useCore>;
  close: () => void;
}) {
  const { role, townId } = useUI();
  const [msg, setMsg] = useState("");
  const { register, handleSubmit } = useForm({
    defaultValues: {
      machineId: data.machines[0]?.id,
      category: "Hydraulic leak",
      severity: "SERIOUS",
      notes: "",
      canMoveSafely: false,
    },
  });
  const go = async (p: any) => {
    const m = data.machines.find((x) => x.id === p.machineId)!;
    try {
      const out = await queueOrValidate(
        makeOp(
          "maintenance-lock",
          crypto.randomUUID(),
          m.version,
          p,
          { machine: m, reservations: data.reservations },
          role,
          townId,
        ),
      );
      setMsg(
        out.queued
          ? "Saved on this device · Waiting for connection"
          : "Machine locked; bookings marked at risk",
      );
    } catch (e: any) {
      setMsg(e.message || "Needs review");
    }
  };
  return (
    <Modal title="Report problem" close={close}>
      <form onSubmit={handleSubmit(go)}>
        <label>
          Machine
          <select {...register("machineId")}>
            {data.machines.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Problem
          <select {...register("category")}>
            {[
              "Hydraulic leak",
              "Engine issue",
              "Tyre or track damage",
              "Brake or steering problem",
              "Electrical issue",
              "Attachment damage",
              "Other",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select {...register("severity")}>
            <option>MONITOR</option>
            <option>SERIOUS</option>
            <option>CRITICAL</option>
          </select>
        </label>
        <label>
          What happened?
          <textarea required {...register("notes")} />
        </label>
        <label className="confirm">
          <input type="checkbox" {...register("canMoveSafely")} />
          Can the machine be moved safely?
        </label>
        <label className="upload">
          <Upload /> Add photo
          <input type="file" />
        </label>
        {msg && <Notice text={msg} />}
        <button className="danger sticky">Save report</button>
      </form>
    </Modal>
  );
}
function RepairForm({
  record,
  data,
  close,
}: {
  record: Maintenance;
  data: ReturnType<typeof useCore>;
  close: () => void;
}) {
  const { role, townId } = useUI();
  const [msg, setMsg] = useState("");
  const m = data.machines.find((x) => x.id === record.machineId)!;
  const { register, handleSubmit } = useForm({
    defaultValues: {
      diagnosis: record.diagnosis || "",
      repairActions: record.repairActions || "",
      partsUsed: record.partsUsed || "",
      completionNotes: record.completionNotes || "",
      clearanceNotes: "",
    },
  });
  const clear = role === "TOWN_ADMIN";
  const go = async (p: any) => {
    const type = clear ? "maintenance-clearance" : "repair-completion";
    try {
      const result = await queueOrValidate(
        makeOp(
          type,
          record.id,
          m.version,
          { ...record, ...p },
          {
            machine: m,
            reservations: data.reservations,
            maintenanceRecords: data.maintenance,
          },
          role,
          townId,
        ),
      );
      setMsg(
        clear
          ? "Machine cleared for use"
          : "Repair complete · Machine available to all towns",
      );
      if (!result.queued) setTimeout(close, 700);
    } catch (e: any) {
      setMsg(e.message || "Needs review");
    }
  };
  return (
    <Modal title={clear ? "Clear for use" : "Record repair"} close={close}>
      <form onSubmit={handleSubmit(go)}>
        {clear ? (
          <>
            <div className="notice">
              <CheckCircle2 />
              Mechanic marked repair complete
            </div>
            <p>{record.completionNotes}</p>
            <label>
              Clearance notes
              <textarea required {...register("clearanceNotes")} />
            </label>
          </>
        ) : (
          <>
            <label>
              Diagnosis
              <textarea required {...register("diagnosis")} />
            </label>
            <label>
              Repair actions
              <textarea required {...register("repairActions")} />
            </label>
            <label>
              Parts used
              <input {...register("partsUsed")} />
            </label>
            <label>
              Completion notes
              <textarea required {...register("completionNotes")} />
            </label>
            <label className="upload">
              <Upload /> Add repair document
              <input type="file" />
            </label>
          </>
        )}
        {msg && <Notice text={msg} />}
        <button type="submit" className="primary sticky">
          {clear ? "Clear machine for use" : "Mark repair complete"}
        </button>
      </form>
    </Modal>
  );
}
function Audit() {
  const events =
    useLiveQuery(
      () => db.auditEvents.orderBy("timestamp").reverse().toArray(),
      [],
    ) || [];
  const machines = useLiveQuery(() => db.machines.toArray(), []) || [];
  const towns = (useLiveQuery(() => db.towns.toArray(), []) || []).map(
    neutralTown,
  );
  const [machine, setMachine] = useState("");
  const [town, setTown] = useState("");
  const [type, setType] = useState("");
  const filtered = events.filter(
    (e) =>
      (!machine || e.machineId === machine) &&
      (!town || e.actingTownId === town) &&
      (!type || e.action === type),
  );
  return (
    <>
      <Head
        over="TAMPER-EVIDENT HISTORY"
        title="Audit timeline"
        sub="Hash-linked records cannot be edited or deleted in this app."
      />
      <div className="filters">
        <select
          aria-label="Machine filter"
          value={machine}
          onChange={(e) => setMachine(e.target.value)}
        >
          <option value="">All machines</option>
          {machines.map((m) => (
            <option value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          aria-label="Town filter"
          value={town}
          onChange={(e) => setTown(e.target.value)}
        >
          <option value="">All towns</option>
          {towns.map((t) => (
            <option value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          aria-label="Event filter"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All events</option>
          {[...new Set(events.map((e) => e.action))].map((x) => (
            <option>{x.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>
      <div className="timeline">
        {filtered.map((e) => (
          <article key={e.id}>
            <div className="timelineicon">
              <History />
            </div>
            <div>
              <span>
                {format(new Date(e.timestamp), "d MMM yyyy · h:mm a")}
              </span>
              <h3>{e.action.replaceAll("_", " ")}</h3>
              <p>{e.reason}</p>
              <small>
                {e.machineId} · {labels[e.actingRole]}{" "}
                {e.actingTownId
                  ? "· " + towns.find((t) => t.id === e.actingTownId)?.name
                  : ""}
              </small>
              <code>SHA-256 {e.currentEventHash.slice(0, 18)}…</code>
            </div>
            <CheckCircle2 className="verified" />
          </article>
        ))}
      </div>
    </>
  );
}
function Conflicts() {
  const ops =
    useLiveQuery(
      () =>
        db.pendingOperations
          .where("status")
          .anyOf("CONFLICT", "FAILED_VALIDATION", "PENDING_SYNC")
          .toArray(),
      [],
    ) || [];
  return (
    <>
      <Head
        over="OFFLINE OUTBOX"
        title="Needs review"
        sub="Your entered data is kept until you decide what to do."
      />
      <div className="conflicts">
        {ops.map((o) => (
          <article key={o.operationId}>
            <FileClock />
            <div>
              <Status value={o.status} />
              <h3>{o.operationType.replaceAll("-", " ")}</h3>
              <p>{o.lastError || "Waiting for connection"}</p>
              <small>
                Saved {format(new Date(o.createdAt), "d MMM, h:mm a")}
              </small>
            </div>
            <button onClick={() => db.pendingOperations.delete(o.operationId)}>
              Discard local draft
            </button>
          </article>
        ))}
        {!ops.length && (
          <Empty text="Nothing needs review. Your local changes are synced." />
        )}
      </div>
    </>
  );
}
function makeOp(
  type: string,
  id: string,
  version: number,
  payload: Record<string, unknown>,
  currentState: Record<string, unknown>,
  role: Role,
  townId: string,
): PendingOperation {
  return {
    operationId: crypto.randomUUID(),
    operationType: type,
    entityId: id,
    baseVersion: version,
    createdAt: new Date().toISOString(),
    payload,
    currentState,
    actor: { role, townId: role === "CREW_CHIEF" ? townId : undefined },
    status: "PENDING_SYNC",
    retryCount: 0,
  };
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.currentTarget === e.target && close()}
    >
      <section className="modal">
        <header>
          <div>
            <span>ROADSHARE · TOWN A–D</span>
            <h2>{title}</h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="modalbody">{children}</div>
      </section>
    </div>
  );
}
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
      {error && <em className="error">{error}</em>}
    </label>
  );
}
function Notice({ text }: { text: string }) {
  return (
    <div className="notice">
      <CheckCircle2 />
      {text}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <CheckCircle2 />
      <p>{text}</p>
    </div>
  );
}

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { db } from "../db/database";
import { useUI } from "../stores/ui";
beforeAll(async () => {
  await db.delete();
  await db.open();
});
beforeEach(() => {
  useUI.setState({
    role: "CREW_CHIEF",
    townId: "mangalparthy",
    offlineTest: false,
  });
});
afterEach(() => cleanup());
describe("RoadShare prototype", () => {
  it("seeds four towns and three machines in IndexedDB", async () => {
    expect(await db.towns.count()).toBe(4);
    expect(await db.machines.count()).toBe(3);
  });
  it("seeds the four showcase states", async () => {
    const machines = await db.machines.toArray();
    expect(machines.filter((machine) => machine.status === "AVAILABLE")).toHaveLength(1);
    expect(machines.filter((machine) => machine.status === "IN_USE")).toHaveLength(1);
    expect(machines.filter((machine) => machine.status === "MAINTENANCE_LOCKED")).toHaveLength(1);
    expect(await db.emergencyRequests.where("status").equals("PENDING").count()).toBe(1);
    const active = await db.reservations.where("status").equals("ACTIVE").first();
    expect(active && new Date(active.endAt).getTime()).toBeGreaterThan(Date.now());
  });
  it("switches roles and lets every role change the town view", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText("Town A view");
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "TOWN_ADMIN" },
    });
    expect(screen.getByLabelText("Town")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Town"), {
      target: { value: "kuknoor" },
    });
    expect(await screen.findByText("Town D view")).toBeInTheDocument();
  });
  it("shows completed repairs as awaiting admin clearance", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Awaiting clearance")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Equipment Admin clearance")).toBeInTheDocument();
  });
  it("renders hash-linked audit history", async () => {
    render(
      <MemoryRouter initialEntries={["/audit"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Hash-linked records/)).toBeInTheDocument();
    expect((await screen.findAllByText(/SHA-256/)).length).toBeGreaterThan(0);
  });
  it("prevents audit records from being edited or deleted", async () => {
    const event = await db.auditEvents.toCollection().first();
    expect(event).toBeDefined();
    await expect(
      db.auditEvents.update(event!.id, { reason: "changed" }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditEvents.delete(event!.id)).rejects.toThrow(/append-only/);
  });
  it("exposes the reset demo data control", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Reset Demo Data")).toBeInTheDocument();
  });
  it("explains each role with a connected workflow", async () => {
    render(
      <MemoryRouter initialEntries={["/roles"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Who does what")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crew Chief" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Equipment Admin" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fleet Mechanic" })).toBeInTheDocument();
    expect(screen.getByText("Accountability chain")).toBeInTheDocument();
  });
});

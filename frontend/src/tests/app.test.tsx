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
  it("renders the maintenance lock prominently", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Under repair")).toBeInTheDocument();
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
  it("exposes the reset demo data control", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Reset Demo Data")).toBeInTheDocument();
  });
});

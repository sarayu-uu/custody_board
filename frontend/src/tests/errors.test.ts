import { describe, expect, it } from "vitest";
import { userFacingError } from "../services/errors";

describe("actionable error messages", () => {
  it.each([
    ["RESERVATION_OVERLAP", "ERROR: Another town booked this time. Choose a different time."],
    ["RESERVATION_IN_PAST", "ERROR: Choose a future start time."],
    ["MACHINE_MAINTENANCE_LOCKED", "ERROR: This machine is under maintenance. Choose another machine."],
    ["EMERGENCY_OVERLAP", "ERROR: Another emergency already uses this machine. Choose another time or machine."],
    ["PROOF_REQUIRED", "ERROR: Add a photo or document before reporting the defect."],
  ])("maps %s", (code, expected) => {
    expect(userFacingError({ code, message: "wrong raw message" })).toBe(expected);
  });

  it("shows the required field by name", () => {
    expect(userFacingError({ code: "FIELD_REQUIRED", field: "conditionNotes" })).toBe(
      "ERROR: Enter condition notes.",
    );
  });

  it("shows a short network instruction", () => {
    expect(userFacingError(new TypeError("Failed to fetch"))).toBe(
      "ERROR: Server unavailable. Saved in Needs review. Retry when online.",
    );
  });
});

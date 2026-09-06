const messages: Record<string, string> = {
  RESERVATION_IN_PAST: "Choose a future start time.",
  RESERVATION_OVERLAP: "Another town booked this time. Choose a different time.",
  MACHINE_MAINTENANCE_LOCKED: "This machine is under maintenance. Choose another machine.",
  NOT_CURRENT_CUSTODIAN: "Only the town holding this machine can hand it over.",
  HOUR_METER_DECREASE: "Hour meter cannot be lower than the last reading.",
  RECEIVING_CONFIRMATION_REQUIRED: "The receiving crew must confirm custody.",
  INVALID_RECEIVER: "Choose a different receiving town.",
  RECEIVER_BOOKING_MISMATCH: "Handoff must go to the town with the next booking.",
  EMERGENCY_IN_PAST: "Choose an emergency start time later than now.",
  EMERGENCY_OVERLAP: "Another emergency already uses this machine. Choose another time or machine.",
  PROOF_REQUIRED: "Add a photo or document before reporting the defect.",
  MAINTENANCE_ALREADY_LOCKED: "This machine already has a maintenance lock.",
  REPAIR_NOT_COMPLETE: "The mechanic must complete the repair first.",
  ROLE_NOT_ALLOWED: "Switch to the correct role to perform this action.",
  INVALID_DATE_RANGE: "Enter a valid start and end time.",
  INVALID_TRANSITION: "This action is no longer available. Refresh and check the current status.",
  INTERNAL_ERROR: "The server could not complete this action. Try again.",
};

const fieldNames: Record<string, string> = {
  purpose: "purpose",
  workLocation: "work location",
  justification: "emergency reason",
  fuelPercentage: "fuel level",
  hourMeter: "hour meter",
  conditionNotes: "condition notes",
  notes: "defect notes",
  diagnosis: "diagnosis",
  repairActions: "repair actions",
  completionNotes: "completion notes",
};

export function userFacingError(error: any) {
  const raw = String(error?.message || "");
  if (
    error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    error?.name === "TypeError" ||
    /failed to fetch|networkerror|load failed|timed out/i.test(raw)
  ) {
    return "ERROR: Server unavailable. Saved in Needs review. Retry when online.";
  }
  if (error?.code === "FIELD_REQUIRED") {
    const label = fieldNames[error?.field] || "required information";
    return `ERROR: Enter ${label}.`;
  }
  return `ERROR: ${messages[error?.code] || raw || "Action failed. Check the form and try again."}`;
}

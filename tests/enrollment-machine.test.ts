import { describe, expect, it } from "vitest";

import { createEnrollmentScreenContext } from "../src/lib/enrollment-context";
import {
  applyEvents,
  createInitialEnrollmentState,
  enrollmentReducer,
} from "../src/lib/enrollment-machine";
import { maskSensitiveValue } from "../src/lib/masking";
import type { EnrollmentEvent, EnrollmentState } from "../src/types/enrollment";

const requirementEvents: EnrollmentEvent[] = [
  { type: "TOGGLE_REQUIREMENT", requirementId: "identificationCardAvailable" },
  { type: "TOGGLE_REQUIREMENT", requirementId: "familyCardAvailable" },
  { type: "TOGGLE_REQUIREMENT", requirementId: "phoneNumberAvailable" },
  { type: "TOGGLE_REQUIREMENT", requirementId: "emailAddressReady" },
];

function completeEnrollment(): EnrollmentState {
  return applyEvents(createInitialEnrollmentState(), [
    { type: "START_MANUAL" },
    ...requirementEvents,
    { type: "NEXT" },
    { type: "UPDATE_FIELD", fieldId: "familyCardNumber", value: "3273000000003210" },
    { type: "UPDATE_FIELD", fieldId: "relationship", value: "self" },
    { type: "NEXT" },
    { type: "UPDATE_FIELD", fieldId: "fullName", value: "Budi Santoso" },
    { type: "UPDATE_FIELD", fieldId: "dateOfBirth", value: "1959-04-12" },
    { type: "UPDATE_FIELD", fieldId: "phoneNumber", value: "081234567890" },
    { type: "NEXT" },
    { type: "REQUEST_FACILITY_CONFIRMATION", facilityId: "taman-sari" },
    { type: "CONFIRM_FACILITY" },
    { type: "NEXT" },
  ]);
}

describe("deterministic enrollment state machine", () => {
  it("starts manually and ignores attempts to skip an incomplete step", () => {
    const welcome = createInitialEnrollmentState();
    expect(enrollmentReducer(welcome, { type: "NEXT" })).toBe(welcome);

    const requirements = enrollmentReducer(welcome, { type: "START_MANUAL" });
    const blocked = enrollmentReducer(requirements, { type: "NEXT" });

    expect(blocked.screenId).toBe("requirements");
    expect(Object.keys(blocked.errors)).toHaveLength(4);
    expect(blocked.focusRequest?.fieldId).toBe("identificationCardAvailable");
  });

  it("advances only after each step is complete", () => {
    const family = applyEvents(createInitialEnrollmentState(), [
      { type: "START_MANUAL" },
      ...requirementEvents,
      { type: "NEXT" },
    ]);
    expect(family.screenId).toBe("family-information");

    const blockedFamily = enrollmentReducer(family, { type: "NEXT" });
    expect(blockedFamily.screenId).toBe("family-information");
    expect(blockedFamily.focusRequest?.fieldId).toBe("familyCardNumber");

    expect(completeEnrollment().screenId).toBe("review");
  });

  it("rejects stale field updates from a different screen", () => {
    const requirements = enrollmentReducer(createInitialEnrollmentState(), {
      type: "START_MANUAL",
    });
    const staleUpdate = enrollmentReducer(requirements, {
      type: "UPDATE_FIELD",
      fieldId: "phoneNumber",
      value: "081234567890",
    });

    expect(staleUpdate).toBe(requirements);
    expect(staleUpdate.data.phoneNumber).toBe("");
  });

  it("normalizes numeric sensitive input before storing it in memory", () => {
    const family = applyEvents(createInitialEnrollmentState(), [
      { type: "START_MANUAL" },
      ...requirementEvents,
      { type: "NEXT" },
    ]);
    const normalized = enrollmentReducer(family, {
      type: "UPDATE_FIELD",
      fieldId: "familyCardNumber",
      value: "3273 0000 letters 0000 321099",
    });

    expect(normalized.data.familyCardNumber).toBe("3273000000003210");
  });

  it("requires explicit facility confirmation", () => {
    let facility = enrollmentReducer(completeEnrollment(), { type: "PREVIOUS" });
    facility = enrollmentReducer(facility, {
      type: "REQUEST_FACILITY_CONFIRMATION",
      facilityId: "cendana",
    });

    expect(facility.data.facilityId).toBe("taman-sari");
    expect(facility.pendingFacilityId).toBe("cendana");

    facility = enrollmentReducer(facility, { type: "CONFIRM_FACILITY" });
    expect(facility.data.facilityId).toBe("cendana");
    expect(facility.pendingFacilityId).toBeNull();
  });

  it("masks sensitive values while preserving only the visible tail", () => {
    expect(maskSensitiveValue("3273000000003210", 4)).toBe("•••• •••• •••• 3210");
    expect(maskSensitiveValue("081234567890", 4)).toBe("•••• •••• 7890");
    expect(maskSensitiveValue("081234567890", 3)).toBe("•••• •••• •890");
  });

  it("sanitizes screen context without exposing field values", () => {
    const state = completeEnrollment();
    const familyState: EnrollmentState = {
      ...state,
      screenId: "family-information",
      data: { ...state.data, relationship: "" },
      errors: { relationship: "Choose the participant’s relationship." },
    };
    const context = createEnrollmentScreenContext(familyState);
    const serialized = JSON.stringify(context);

    expect(context?.fields).toMatchObject([
      { id: "familyCardNumber", complete: true, sensitive: true, error: null },
      {
        id: "relationship",
        complete: false,
        sensitive: false,
        error: "Choose the participant’s relationship.",
      },
    ]);
    expect(serialized).not.toContain("3273000000003210");
    expect(serialized).not.toContain("081234567890");
    expect(serialized).not.toContain("Budi Santoso");
    expect(serialized).not.toMatch(/"value"/);
  });

  it("resets all in-memory data and returns to Welcome", () => {
    const reset = enrollmentReducer(completeEnrollment(), { type: "RESET" });
    expect(reset).toEqual(createInitialEnrollmentState());
  });

  it("edits the requested Review section and returns directly to Review", () => {
    const review = completeEnrollment();
    const editing = enrollmentReducer(review, {
      type: "EDIT_STEP",
      step: "participant-information",
    });

    expect(editing.screenId).toBe("participant-information");
    expect(editing.returningToReview).toBe(true);

    const returned = enrollmentReducer(editing, { type: "NEXT" });
    expect(returned.screenId).toBe("review");
    expect(returned.returningToReview).toBe(false);
  });
});

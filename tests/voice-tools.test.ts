import { describe, expect, it, vi } from "vitest";

import {
  createEnrollmentScreenContext,
  serializeEnrollmentScreenContext,
} from "../src/lib/enrollment-context";
import {
  applyEvents,
  createInitialEnrollmentState,
} from "../src/lib/enrollment-machine";
import { applyVoiceFieldHighlight } from "../src/lib/voice-highlight";
import {
  executeVoiceTool,
  voiceToolDefinitions,
  type VoiceToolCall,
} from "../src/lib/voice-tools";
import type {
  EnrollmentEvent,
  EnrollmentState,
  SpeechPreference,
} from "../src/types/enrollment";

const requirementEvents: EnrollmentEvent[] = [
  { type: "TOGGLE_REQUIREMENT", requirementId: "identificationCardAvailable" },
  { type: "TOGGLE_REQUIREMENT", requirementId: "familyCardAvailable" },
  { type: "TOGGLE_REQUIREMENT", requirementId: "phoneNumberAvailable" },
  { type: "TOGGLE_REQUIREMENT", requirementId: "emailAddressReady" },
];

function familyState(): EnrollmentState {
  return applyEvents(createInitialEnrollmentState(), [
    { type: "START_MANUAL" },
    ...requirementEvents,
    { type: "NEXT" },
  ]);
}

function completeState(screenId: EnrollmentState["screenId"] = "review"): EnrollmentState {
  const review = applyEvents(createInitialEnrollmentState(), [
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
  return { ...review, screenId };
}

function execute(
  state: EnrollmentState,
  name: string,
  args: unknown = {},
  preference: SpeechPreference = "normal",
) {
  const context = createEnrollmentScreenContext(state, preference);
  const call: VoiceToolCall = {
    callId: "call-1",
    name,
    arguments: args,
    expectedContextKey: serializeEnrollmentScreenContext(context),
  };
  return executeVoiceTool(call, state, context);
}

describe("verified client-side voice tools", () => {
  it("executes an allowlisted read-only screen explanation", () => {
    const state = familyState();
    const execution = execute(state, "explain_current_screen");

    expect(execution.result).toMatchObject({
      status: "success",
      screenId: "family-information",
      nextRequiredField: "familyCardNumber",
    });
    expect(execution.nextState).toBeUndefined();
  });

  it("rejects unknown tools and malformed arguments without mutation", () => {
    const state = familyState();
    const before = JSON.stringify(state);
    const unknown = execute(state, "run_javascript");
    const malformed = execute(state, "highlight_field", {
      fieldId: "familyCardNumber",
      selector: "body",
    });

    expect(unknown.result).toMatchObject({ status: "blocked", code: "unknown_tool" });
    expect(malformed.result).toMatchObject({
      status: "blocked",
      code: "invalid_arguments",
    });
    expect(JSON.stringify(state)).toBe(before);
    expect(unknown.nextState).toBeUndefined();
    expect(malformed.nextState).toBeUndefined();
  });

  it("rejects a tool unavailable on the active screen", () => {
    const execution = execute(createInitialEnrollmentState(), "highlight_field", {
      fieldId: "familyCardNumber",
    });
    expect(execution.result).toMatchObject({
      status: "blocked",
      code: "action_unavailable",
    });
  });

  it("rejects a field identifier not present on the active screen", () => {
    const execution = execute(familyState(), "highlight_field", {
      fieldId: "phoneNumber",
    });
    expect(execution.result).toMatchObject({
      status: "blocked",
      code: "unknown_field",
    });
  });

  it("rejects stale context before evaluating or mutating an action", () => {
    const state = familyState();
    const context = createEnrollmentScreenContext(state);
    const execution = executeVoiceTool(
      {
        callId: "stale-call",
        name: "go_to_next_step",
        arguments: {},
        expectedContextKey: "older-screen-context",
      },
      state,
      context,
    );

    expect(execution.result).toMatchObject({
      status: "blocked",
      code: "stale_context",
    });
    expect(execution.nextState).toBeUndefined();
  });

  it("returns a valid focus request without changing a field value", () => {
    const state = familyState();
    const execution = execute(state, "highlight_field", {
      fieldId: "familyCardNumber",
    });
    expect(execution.highlightFieldId).toBe("familyCardNumber");
    expect(execution.result).toMatchObject({ status: "success" });
    expect(state.data.familyCardNumber).toBe("");
  });

  it("focuses, scrolls, highlights, and cleans up through fixed DOM mappings", () => {
    const add = vi.fn();
    const remove = vi.fn();
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const target = { classList: { add, remove }, scrollIntoView };
    const control = { closest: vi.fn().mockReturnValue(target), focus };
    const ownerDocument = {
      getElementById: vi.fn().mockReturnValue(control),
      querySelector: vi.fn(),
    };

    const cleanup = applyVoiceFieldHighlight(
      ownerDocument,
      "familyCardNumber",
      true,
    );

    expect(ownerDocument.getElementById).toHaveBeenCalledWith("familyCardNumber");
    expect(add).toHaveBeenCalledWith("voice-tool-highlight");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    cleanup?.();
    expect(remove).toHaveBeenCalledWith("voice-tool-highlight");
  });

  it("blocks navigation on validation failure and focuses the first invalid field", () => {
    const state = familyState();
    const execution = execute(state, "go_to_next_step");

    expect(execution.result).toMatchObject({
      status: "blocked",
      code: "validation_failed",
      missingFields: ["familyCardNumber", "relationship"],
    });
    expect(execution.nextState?.screenId).toBe("family-information");
    expect(execution.nextState?.focusRequest?.fieldId).toBe("familyCardNumber");
  });

  it("validates without navigation and advances exactly one step when complete", () => {
    const family = applyEvents(familyState(), [
      { type: "UPDATE_FIELD", fieldId: "familyCardNumber", value: "3273000000003210" },
      { type: "UPDATE_FIELD", fieldId: "relationship", value: "self" },
    ]);
    const validation = execute(family, "validate_current_step");
    const navigation = execute(family, "go_to_next_step");

    expect(validation.result).toEqual({ status: "success", canProceed: true });
    expect(validation.nextState?.screenId).toBe("family-information");
    expect(navigation.nextState?.screenId).toBe("participant-information");
    expect(createEnrollmentScreenContext(navigation.nextState!).screenId).toBe(
      "participant-information",
    );
  });

  it("returns to only the previous step while preserving in-memory data", () => {
    const participant = completeState("participant-information");
    const execution = execute(participant, "go_to_previous_step");

    expect(execution.nextState?.screenId).toBe("family-information");
    expect(execution.nextState?.data).toEqual(participant.data);
  });

  it("blocks Review while incomplete and opens it when all required steps are complete", () => {
    const blocked = execute(familyState(), "show_review");
    const complete = completeState("participant-information");
    const opened = execute(complete, "show_review");

    expect(blocked.result).toMatchObject({
      status: "blocked",
      code: "enrollment_incomplete",
    });
    expect(blocked.result.incompleteSections).toContain("family-information");
    expect(opened.nextState?.screenId).toBe("review");
    expect(opened.result).toMatchObject({ status: "success", submitted: false });
  });

  it("cannot select or confirm a fictional facility", () => {
    const facility = completeState("facility-selection");
    const state = {
      ...facility,
      data: { ...facility.data, facilityId: null },
      pendingFacilityId: null,
    };
    const execution = execute(state, "highlight_field", { fieldId: "facilityId" });

    expect(execution.result.status).toBe("success");
    expect(state.data.facilityId).toBeNull();
    expect(state.pendingFacilityId).toBeNull();
    expect(voiceToolDefinitions.map((tool) => tool.name)).not.toContain(
      "select_facility",
    );
  });

  it("returns only sanitized identifiers and never raw form values", () => {
    const state = completeState("family-information");
    const result = JSON.stringify(execute(state, "explain_current_screen").result);

    for (const value of [
      "3273000000003210",
      "081234567890",
      "Budi Santoso",
      "1959-04-12",
    ]) {
      expect(result).not.toContain(value);
    }
  });

  it("uses a documented behavioral speech preference without claiming audio speed changed", () => {
    const execution = execute(familyState(), "set_speech_preference", {
      pace: "slow",
    });
    expect(execution.speechPreference).toBe("slow");
    expect(execution.result).toMatchObject({
      status: "success",
      pace: "slow",
      audioSpeedChanged: false,
    });
  });

  it("declares exactly the fixed Phase 5 allowlist with strict object schemas", () => {
    expect(voiceToolDefinitions.map((tool) => tool.name)).toEqual([
      "explain_current_screen",
      "highlight_field",
      "validate_current_step",
      "go_to_next_step",
      "go_to_previous_step",
      "repeat_instruction",
      "set_speech_preference",
      "show_review",
    ]);
    expect(
      voiceToolDefinitions.every(
        (tool) => tool.parameters.additionalProperties === false,
      ),
    ).toBe(true);
    expect(voiceToolDefinitions.every((tool) => tool.timeout_seconds === 10)).toBe(
      true,
    );
  });
});

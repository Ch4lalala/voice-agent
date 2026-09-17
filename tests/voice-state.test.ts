import { describe, expect, it } from "vitest";

import { createInitialEnrollmentState } from "../src/lib/enrollment-machine";
import { initialVoiceState, voiceStateReducer } from "../src/lib/voice-state";

describe("Voice Guide lifecycle", () => {
  it("derives every lifecycle state from connection and voice events", () => {
    let state = voiceStateReducer(initialVoiceState, { type: "START_REQUESTED" });
    expect(state.status).toBe("connecting");

    state = voiceStateReducer(state, { type: "SESSION_READY" });
    expect(state.status).toBe("listening");

    state = voiceStateReducer(state, { type: "USER_SPEECH_STOPPED" });
    expect(state.status).toBe("thinking");

    state = voiceStateReducer(state, { type: "REPLY_AUDIO" });
    expect(state.status).toBe("speaking");

    state = voiceStateReducer(state, { type: "REPLY_DONE" });
    expect(state.status).toBe("listening");

    state = voiceStateReducer(state, {
      type: "FAILED",
      code: "connection-failed",
    });
    expect(state.status).toBe("error");

    state = voiceStateReducer(state, { type: "ENDED" });
    expect(state).toEqual({
      ...initialVoiceState,
      guidanceMessage:
        "Voice guidance ended. Your enrollment information is unchanged.",
    });
  });

  it("replaces partial user captions and records the final agent caption", () => {
    let state = voiceStateReducer(initialVoiceState, {
      type: "USER_TRANSCRIPT",
      text: "Hello",
    });
    state = voiceStateReducer(state, {
      type: "USER_TRANSCRIPT",
      text: "Hello there",
    });
    state = voiceStateReducer(state, {
      type: "AGENT_TRANSCRIPT",
      text: "Hello there.",
    });

    expect(state.userCaption).toBe("Hello there");
    expect(state.agentCaption).toBe("Hello there.");
  });

  it("announces safe tool feedback and clears it on the next user turn", () => {
    let state = voiceStateReducer(initialVoiceState, {
      type: "TOOL_FEEDBACK",
      kind: "success",
      message: "Family Card Number is focused and highlighted.",
    });
    expect(state.toolFeedback).toBe(
      "Family Card Number is focused and highlighted.",
    );

    state = voiceStateReducer(state, { type: "USER_SPEECH_STARTED" });
    expect(state.toolFeedback).toBe("");
    expect(state.toolFeedbackKind).toBeNull();
  });

  it("announces a safety response and clears it before the next utterance", () => {
    let state = voiceStateReducer(initialVoiceState, {
      type: "SAFETY_NOTICE",
      message: "Please type sensitive information instead.",
    });
    expect(state.safetyNotice).toBe("Please type sensitive information instead.");

    state = voiceStateReducer(state, { type: "USER_SPEECH_STARTED" });
    expect(state.safetyNotice).toBe("");
  });

  it("does not alter enrollment state after a voice failure", () => {
    const enrollmentState = createInitialEnrollmentState();
    const voiceState = voiceStateReducer(initialVoiceState, {
      type: "FAILED",
      code: "connection-failed",
    });

    expect(voiceState.status).toBe("error");
    expect(enrollmentState).toEqual(createInitialEnrollmentState());
  });

  it("reports clean guidance end without changing enrollment state", () => {
    const state = voiceStateReducer(
      { ...initialVoiceState, status: "listening" },
      { type: "ENDED" },
    );
    expect(state.status).toBe("off");
    expect(state.guidanceMessage).toContain("enrollment information is unchanged");
  });

  it("announces Requirements once normal listening resumes after the greeting", () => {
    const state = voiceStateReducer(
      { ...initialVoiceState, status: "speaking" },
      { type: "GUIDED_JOURNEY_READY" },
    );

    expect(state.status).toBe("listening");
    expect(state.guidanceMessage).toBe("Requirements, step 1 of 5.");
  });
});

import type { VoiceState, VoiceStateEvent } from "@/types/voice";

export const initialVoiceState: VoiceState = {
  status: "off",
  userCaption: "",
  agentCaption: "",
  errorCode: null,
  toolFeedback: "",
  toolFeedbackKind: null,
  safetyNotice: "",
  guidanceMessage: "",
};

export function voiceStateReducer(
  state: VoiceState,
  event: VoiceStateEvent,
): VoiceState {
  switch (event.type) {
    case "START_REQUESTED":
      return { ...initialVoiceState, status: "connecting" };
    case "SESSION_READY":
      return { ...state, status: "listening", errorCode: null };
    case "USER_SPEECH_STARTED":
      return {
        ...state,
        status: "listening",
        userCaption: "",
        errorCode: null,
        toolFeedback: "",
        toolFeedbackKind: null,
        safetyNotice: "",
        guidanceMessage: "",
      };
    case "USER_SPEECH_STOPPED":
      return { ...state, status: "thinking", errorCode: null };
    case "REPLY_STARTED":
      return { ...state, status: "thinking", agentCaption: "", errorCode: null };
    case "USER_TRANSCRIPT":
      return { ...state, userCaption: event.text };
    case "REPLY_AUDIO":
      return { ...state, status: "speaking", errorCode: null };
    case "AGENT_TRANSCRIPT":
      return { ...state, agentCaption: event.text };
    case "REPLY_DONE":
      return { ...state, status: "listening", errorCode: null };
    case "GUIDED_JOURNEY_READY":
      return {
        ...state,
        status: "listening",
        errorCode: null,
        guidanceMessage: "Requirements, step 1 of 5.",
      };
    case "TOOL_FEEDBACK":
      return {
        ...state,
        toolFeedback: event.message,
        toolFeedbackKind: event.kind,
      };
    case "SAFETY_NOTICE":
      return { ...state, safetyNotice: event.message };
    case "FAILED":
      return { ...state, status: "error", errorCode: event.code };
    case "ENDED":
      return {
        ...initialVoiceState,
        guidanceMessage:
          "Voice guidance ended. Your enrollment information is unchanged.",
      };
    default:
      return state;
  }
}

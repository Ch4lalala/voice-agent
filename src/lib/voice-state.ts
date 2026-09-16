import type { VoiceState, VoiceStateEvent } from "@/types/voice";

export const initialVoiceState: VoiceState = {
  status: "off",
  userCaption: "",
  agentCaption: "",
  errorCode: null,
  toolFeedback: "",
  safetyNotice: "",
  resolvedTranscriptionMode: null,
  englishLanguageSteering: null,
  latencyMetrics: {},
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
        safetyNotice: "",
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
    case "TOOL_FEEDBACK":
      return { ...state, toolFeedback: event.message };
    case "SAFETY_NOTICE":
      return { ...state, safetyNotice: event.message };
    case "SESSION_CONFIGURATION":
      return {
        ...state,
        resolvedTranscriptionMode: event.transcriptionMode,
        englishLanguageSteering: event.englishLanguageSteering,
      };
    case "LATENCY_METRIC":
      return {
        ...state,
        latencyMetrics: {
          ...state.latencyMetrics,
          [event.metric.name]: event.metric.durationMs,
        },
      };
    case "FAILED":
      return { ...state, status: "error", errorCode: event.code };
    case "ENDED":
      return initialVoiceState;
    default:
      return state;
  }
}

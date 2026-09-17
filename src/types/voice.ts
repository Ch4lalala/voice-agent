export type VoiceStatus =
  | "off"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

export type VoiceErrorCode =
  | "permission-denied"
  | "not-supported"
  | "not-configured"
  | "agent-timeout"
  | "connection-failed";

export interface VoiceState {
  status: VoiceStatus;
  userCaption: string;
  agentCaption: string;
  errorCode: VoiceErrorCode | null;
  toolFeedback: string;
  toolFeedbackKind: "success" | "attention" | null;
  safetyNotice: string;
  guidanceMessage: string;
}

export type VoiceStateEvent =
  | { type: "START_REQUESTED" }
  | { type: "SESSION_READY" }
  | { type: "USER_SPEECH_STARTED" }
  | { type: "USER_SPEECH_STOPPED" }
  | { type: "USER_TRANSCRIPT"; text: string }
  | { type: "REPLY_STARTED" }
  | { type: "REPLY_AUDIO" }
  | { type: "AGENT_TRANSCRIPT"; text: string }
  | { type: "REPLY_DONE" }
  | { type: "GUIDED_JOURNEY_READY" }
  | {
      type: "TOOL_FEEDBACK";
      kind: "success" | "attention";
      message: string;
    }
  | { type: "SAFETY_NOTICE"; message: string }
  | { type: "FAILED"; code: VoiceErrorCode }
  | { type: "ENDED" };

export type VoiceClientEvent = Exclude<VoiceStateEvent, { type: "START_REQUESTED" }>;

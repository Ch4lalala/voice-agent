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
  | "connection-failed";

export interface VoiceState {
  status: VoiceStatus;
  userCaption: string;
  agentCaption: string;
  errorCode: VoiceErrorCode | null;
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
  | { type: "FAILED"; code: VoiceErrorCode }
  | { type: "ENDED" };

export type VoiceClientEvent = Exclude<VoiceStateEvent, { type: "START_REQUESTED" }>;

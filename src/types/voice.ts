import type {
  VoiceLatencyMetric,
  VoiceLatencyMetricName,
} from "@/lib/voice-latency";

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

export type VoiceTranscriptionMode =
  | "min_latency"
  | "balanced"
  | "max_accuracy"
  | "unknown";

export interface VoiceState {
  status: VoiceStatus;
  userCaption: string;
  agentCaption: string;
  errorCode: VoiceErrorCode | null;
  toolFeedback: string;
  safetyNotice: string;
  resolvedTranscriptionMode: VoiceTranscriptionMode | null;
  englishLanguageSteering: boolean | null;
  latencyMetrics: Partial<Record<VoiceLatencyMetricName, number>>;
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
  | { type: "TOOL_FEEDBACK"; message: string }
  | { type: "SAFETY_NOTICE"; message: string }
  | {
      type: "SESSION_CONFIGURATION";
      transcriptionMode: VoiceTranscriptionMode;
      englishLanguageSteering: boolean;
    }
  | { type: "LATENCY_METRIC"; metric: VoiceLatencyMetric }
  | { type: "FAILED"; code: VoiceErrorCode }
  | { type: "ENDED" };

export type VoiceClientEvent = Exclude<VoiceStateEvent, { type: "START_REQUESTED" }>;

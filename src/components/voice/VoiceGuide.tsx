import { useEffect } from "react";

import { useVoiceGuide } from "@/components/voice/VoiceGuideProvider";
import type { EnrollmentScreenId } from "@/types/enrollment";
import type { VoiceState } from "@/types/voice";

type VoiceGuideProps = {
  screenId: EnrollmentScreenId;
};

const statusLabels = {
  off: "Off",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  error: "Error",
} as const;

const errorMessages = {
  "permission-denied":
    "Microphone access was denied. Allow microphone access in your browser, then retry — or continue manually.",
  "not-supported":
    "This browser cannot start the Voice Guide. You can continue the enrollment manually.",
  "not-configured":
    "Voice guidance is not configured on this server. You can continue the enrollment manually.",
  "agent-timeout":
    "The Voice Guide took too long to start. Retry with a fresh connection, or continue manually.",
  "connection-failed":
    "The Voice Guide could not connect. Check your connection and retry, or continue manually.",
} as const;

type VoiceGuideViewProps = VoiceGuideProps & {
  end: () => void;
  start: () => void;
  state: VoiceState;
};

export function VoiceGuideView({
  end,
  screenId,
  start,
  state,
}: VoiceGuideViewProps) {
  const noteId = `${screenId}-voice-note`;
  const errorId = `${screenId}-voice-error`;
  const statusLabel = statusLabels[state.status];
  const isActive = ["listening", "thinking", "speaking"].includes(state.status);
  const canEnd = ["connecting", "listening", "thinking", "speaking"].includes(
    state.status,
  );
  const primaryLabel =
    state.status === "error"
      ? "Retry connection"
      : state.status === "off"
        ? "Start voice guidance"
        : statusLabel;
  const primaryId = `${screenId}-voice-primary`;
  const politeAnnouncement = state.errorCode
    ? ""
    : state.safetyNotice ||
      state.toolFeedback ||
      state.guidanceMessage ||
      (state.agentCaption
        ? `AksesSuara says: ${state.agentCaption}`
        : `Voice Guide status: ${statusLabel}.`);

  useEffect(() => {
    if (state.status !== "error") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(primaryId)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [primaryId, state.status]);

  return (
    <aside className="voice-guide" aria-labelledby={`${screenId}-voice-title`}>
      <div className="voice-guide__rail" aria-hidden="true" />
      <header className="voice-guide__header">
        <div>
          <p className="voice-guide__eyebrow">Built into this step</p>
          <h2 id={`${screenId}-voice-title`}>Voice Guide</h2>
        </div>
        <div
          className={`voice-status voice-status--${state.status}`}
          aria-label={`Voice Guide status: ${statusLabel}`}
        >
          <span className="voice-status__dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
      </header>

      <div className="voice-guide__primary">
        <button
          id={primaryId}
          className="mic-button"
          type="button"
          onClick={start}
          disabled={canEnd}
          aria-describedby={`${noteId}${state.errorCode ? ` ${errorId}` : ""}`}
          aria-busy={state.status === "connecting"}
        >
          <span className="mic-symbol" aria-hidden="true" />
          <span>{primaryLabel}</span>
        </button>

        <div className={`waveform ${isActive ? "waveform--active" : ""}`} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      {state.errorCode ? (
        <p id={errorId} className="voice-guide__error" role="alert">
          {errorMessages[state.errorCode]}
        </p>
      ) : null}

      {state.toolFeedback ? (
        <p
          className={`voice-tool-feedback${state.toolFeedbackKind === "attention" ? " voice-tool-feedback--attention" : ""}`}
        >
          <span aria-hidden="true">
            {state.toolFeedbackKind === "attention" ? "!" : "✓"}
          </span>
          {state.toolFeedback}
        </p>
      ) : null}

      {state.safetyNotice ? (
        <p className="voice-safety-notice">
          <span aria-hidden="true">!</span>
          {state.safetyNotice}
        </p>
      ) : null}

      {state.guidanceMessage ? (
        <p className="voice-guidance-message">{state.guidanceMessage}</p>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {politeAnnouncement}
      </p>

      <div className="captions" aria-label="Live voice captions">
        <p className="captions__label">Live captions · Not saved</p>
        <div className="caption caption--user">
          <span>You</span>
          <p>{state.userCaption || "Your words will appear here after you start speaking."}</p>
        </div>
        <div className="caption caption--guide">
          <span>AksesSuara</span>
          <p>{state.agentCaption || "The Voice Guide’s response will appear here."}</p>
        </div>
      </div>

      <div className="voice-actions" aria-label="Voice Guide actions">
        <button type="button" disabled aria-describedby={noteId}>
          <span aria-hidden="true">↻</span>
          Repeat
        </button>
        <button type="button" disabled aria-describedby={noteId}>
          <span aria-hidden="true">½×</span>
          Speak more slowly
        </button>
        <button type="button" onClick={end} disabled={!canEnd} aria-describedby={noteId}>
          <span aria-hidden="true">□</span>
          End Guidance
        </button>
      </div>

      <p id={noteId} className="voice-guide__note">
        Microphone access starts only when you choose Start. Voice content is not saved. Voice
        actions are checked by the application before they can highlight, validate, or move one
        step. You still enter information and confirm important choices yourself.
      </p>

    </aside>
  );
}

export function VoiceGuide({ screenId }: VoiceGuideProps) {
  const { state, start, end } = useVoiceGuide();
  return (
    <VoiceGuideView
      end={end}
      screenId={screenId}
      start={start}
      state={state}
    />
  );
}

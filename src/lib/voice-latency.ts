export const voiceLatencyMetricNames = [
  "last-input-audio-to-speech-stopped",
  "speech-stopped-to-final-transcript",
  "final-transcript-to-reply-started",
  "reply-started-to-first-audio",
  "tool-call-to-reply-done",
  "reply-done-to-tool-result",
  "tool-result-to-next-reply-started",
] as const;

export type VoiceLatencyMetricName = (typeof voiceLatencyMetricNames)[number];

export interface VoiceLatencyMetric {
  name: VoiceLatencyMetricName;
  durationMs: number;
}

type Clock = () => number;

function metric(
  name: VoiceLatencyMetricName,
  startedAt: number | null,
  finishedAt: number,
): VoiceLatencyMetric | null {
  if (startedAt === null) return null;
  return {
    name,
    durationMs: Math.round(Math.max(0, finishedAt - startedAt) * 10) / 10,
  };
}

export class VoiceLatencyTracker {
  private lastInputAudioAt: number | null = null;
  private speechStoppedAt: number | null = null;
  private finalTranscriptAt: number | null = null;
  private replyStartedAt: number | null = null;
  private firstReplyAudioPending = false;
  private toolCallAt: number | null = null;
  private replyDoneAt: number | null = null;
  private toolResultAt: number | null = null;

  constructor(private readonly now: Clock = () => performance.now()) {}

  reset(): void {
    this.lastInputAudioAt = null;
    this.speechStoppedAt = null;
    this.finalTranscriptAt = null;
    this.replyStartedAt = null;
    this.firstReplyAudioPending = false;
    this.toolCallAt = null;
    this.replyDoneAt = null;
    this.toolResultAt = null;
  }

  recordInputAudio(): void {
    this.lastInputAudioAt = this.now();
  }

  recordSpeechStopped(): VoiceLatencyMetric | null {
    const stoppedAt = this.now();
    const result = metric(
      "last-input-audio-to-speech-stopped",
      this.lastInputAudioAt,
      stoppedAt,
    );
    this.speechStoppedAt = stoppedAt;
    return result;
  }

  recordFinalTranscript(): VoiceLatencyMetric | null {
    const finalAt = this.now();
    const result = metric(
      "speech-stopped-to-final-transcript",
      this.speechStoppedAt,
      finalAt,
    );
    this.finalTranscriptAt = finalAt;
    return result;
  }

  recordReplyStarted(): VoiceLatencyMetric[] {
    const startedAt = this.now();
    const results = [
      metric(
        "final-transcript-to-reply-started",
        this.finalTranscriptAt,
        startedAt,
      ),
      metric(
        "tool-result-to-next-reply-started",
        this.toolResultAt,
        startedAt,
      ),
    ].filter((value): value is VoiceLatencyMetric => value !== null);

    this.finalTranscriptAt = null;
    this.toolResultAt = null;
    this.replyStartedAt = startedAt;
    this.firstReplyAudioPending = true;
    return results;
  }

  recordFirstReplyAudio(): VoiceLatencyMetric | null {
    if (!this.firstReplyAudioPending) return null;
    this.firstReplyAudioPending = false;
    return metric(
      "reply-started-to-first-audio",
      this.replyStartedAt,
      this.now(),
    );
  }

  recordToolCall(): void {
    this.toolCallAt = this.now();
  }

  recordReplyDone(): VoiceLatencyMetric | null {
    const doneAt = this.now();
    const result = metric("tool-call-to-reply-done", this.toolCallAt, doneAt);
    this.toolCallAt = null;
    this.replyDoneAt = doneAt;
    return result;
  }

  recordToolResult(): VoiceLatencyMetric | null {
    const resultAt = this.now();
    const result = metric(
      "reply-done-to-tool-result",
      this.replyDoneAt,
      resultAt,
    );
    this.replyDoneAt = null;
    this.toolResultAt = resultAt;
    return result;
  }
}

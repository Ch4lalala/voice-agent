import { describe, expect, it } from "vitest";

import { VoiceLatencyTracker } from "../src/lib/voice-latency";

describe("VoiceLatencyTracker", () => {
  it("measures each user-turn and response-start interval independently", () => {
    let now = 100;
    const tracker = new VoiceLatencyTracker(() => now);

    tracker.recordInputAudio();
    now = 135;
    expect(tracker.recordSpeechStopped()).toEqual({
      name: "last-input-audio-to-speech-stopped",
      durationMs: 35,
    });
    now = 210;
    expect(tracker.recordFinalTranscript()).toEqual({
      name: "speech-stopped-to-final-transcript",
      durationMs: 75,
    });
    now = 260;
    expect(tracker.recordReplyStarted()).toEqual([
      { name: "final-transcript-to-reply-started", durationMs: 50 },
    ]);
    now = 310;
    expect(tracker.recordFirstReplyAudio()).toEqual({
      name: "reply-started-to-first-audio",
      durationMs: 50,
    });
    now = 340;
    expect(tracker.recordFirstReplyAudio()).toBeNull();
  });

  it("measures the ordered tool continuation without storing call content", () => {
    let now = 500;
    const tracker = new VoiceLatencyTracker(() => now);

    tracker.recordToolCall();
    now = 560;
    expect(tracker.recordReplyDone()).toEqual({
      name: "tool-call-to-reply-done",
      durationMs: 60,
    });
    now = 565;
    expect(tracker.recordToolResult()).toEqual({
      name: "reply-done-to-tool-result",
      durationMs: 5,
    });
    now = 620;
    expect(tracker.recordReplyStarted()).toEqual([
      { name: "tool-result-to-next-reply-started", durationMs: 55 },
    ]);
  });

  it("resets pending timestamps between sessions", () => {
    let now = 10;
    const tracker = new VoiceLatencyTracker(() => now);
    tracker.recordInputAudio();
    tracker.recordToolCall();
    tracker.reset();
    now = 20;

    expect(tracker.recordSpeechStopped()).toBeNull();
    expect(tracker.recordReplyDone()).toBeNull();
  });
});

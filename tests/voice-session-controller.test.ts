import { describe, expect, it, vi } from "vitest";

import {
  VoiceSessionController,
  voiceSessionConfiguration,
  type VoiceAudioSession,
  type VoiceMediaStream,
  type VoiceRuntime,
  type VoiceSocket,
  type VoiceToolHandler,
} from "../src/lib/voice-agent-client";
import { createEnrollmentScreenContext } from "../src/lib/enrollment-context";
import { enrollmentReducer, createInitialEnrollmentState } from "../src/lib/enrollment-machine";
import type { VoiceClientEvent } from "../src/types/voice";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHarness(
  overrides: Partial<VoiceRuntime> = {},
  handleTool?: VoiceToolHandler,
) {
  const stop = vi.fn();
  const stream: VoiceMediaStream = { getTracks: () => [{ stop }] };
  const audio: VoiceAudioSession = {
    play: vi.fn(),
    interrupt: vi.fn(),
    close: vi.fn(),
  };
  const socket: VoiceSocket = {
    readyState: 1,
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send: vi.fn(),
    close: vi.fn(),
  };
  let pushAudioChunk: ((audio: string) => void) | null = null;
  const runtime: VoiceRuntime = {
    requestMicrophone: vi.fn().mockResolvedValue(stream),
    requestToken: vi.fn().mockResolvedValue("temporary-token"),
    createAudioSession: vi.fn().mockImplementation(
      async (_stream: VoiceMediaStream, onAudioChunk: (audio: string) => void) => {
        pushAudioChunk = onAudioChunk;
        return audio;
      },
    ),
    createSocket: vi.fn().mockReturnValue(socket),
    ...overrides,
  };
  const events: VoiceClientEvent[] = [];
  const controller = new VoiceSessionController(
    runtime,
    (event) => events.push(event),
    handleTool,
    true,
  );
  return {
    audio,
    controller,
    events,
    pushAudioChunk: (audioChunk = "AA==") => pushAudioChunk?.(audioChunk),
    runtime,
    socket,
    stop,
    stream,
  };
}

const welcomeContext = createEnrollmentScreenContext(createInitialEnrollmentState());
const requirementsContext = createEnrollmentScreenContext(
  enrollmentReducer(createInitialEnrollmentState(), { type: "START_MANUAL" }),
);

async function makeGuidanceReady(harness: ReturnType<typeof createHarness>) {
  harness.controller.updateContext(welcomeContext);
  await harness.controller.start();
  harness.socket.onopen?.();
  harness.socket.onmessage?.({
    data: JSON.stringify({
      type: "session.ready",
      config: voiceSessionConfiguration.session,
    }),
  });
  acknowledgeLatestContext(harness);
}

function acknowledgeLatestContext(harness: ReturnType<typeof createHarness>) {
  const updates = vi.mocked(harness.socket.send).mock.calls
    .map(([raw]) => JSON.parse(String(raw)) as {
      type: string;
      session?: { system_prompt?: string };
    })
    .filter((message) => message.type === "session.update");
  const systemPrompt = updates.at(-1)?.session?.system_prompt;
  harness.socket.onmessage?.({
    data: JSON.stringify({
      type: "session.updated",
      config: { system_prompt: systemPrompt },
    }),
  });
}

function withoutDiagnostics(events: VoiceClientEvent[]): VoiceClientEvent[] {
  return events.filter(
    (event) =>
      event.type !== "LATENCY_METRIC" &&
      event.type !== "SESSION_CONFIGURATION",
  );
}

function endCleanly(harness: ReturnType<typeof createHarness>) {
  harness.controller.end();
  harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ended" }) });
}

describe("VoiceSessionController", () => {
  it("prevents duplicate sessions while a start is pending", async () => {
    const microphone = deferred<VoiceMediaStream>();
    const harness = createHarness({ requestMicrophone: () => microphone.promise });

    const firstStart = harness.controller.start();
    await expect(harness.controller.start()).resolves.toBe(false);
    microphone.resolve(harness.stream);
    await expect(firstStart).resolves.toBe(true);

    expect(harness.runtime.requestToken).toHaveBeenCalledTimes(1);
    endCleanly(harness);
  });

  it("stops microphone, audio, socket, and stale handlers on disconnect", async () => {
    const harness = createHarness();
    await harness.controller.start();
    harness.socket.onopen?.();
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ready" }) });

    harness.controller.end();

    expect(harness.socket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "session.end" }),
    );
    expect(harness.stop).not.toHaveBeenCalled();
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ended" }) });
    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.audio.close).toHaveBeenCalledOnce();
    expect(harness.socket.close).toHaveBeenCalledOnce();
    expect(harness.socket.onmessage).toBeNull();
    expect(harness.events.at(-1)).toEqual({ type: "ENDED" });
  });

  it("sends session.end once and uses a short bounded fallback before cleanup", async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness();
      await harness.controller.start();
      harness.socket.onopen?.();

      harness.controller.end();
      harness.controller.end();

      const endMessages = vi.mocked(harness.socket.send).mock.calls.filter(
        ([raw]) => String(raw) === JSON.stringify({ type: "session.end" }),
      );
      expect(endMessages).toHaveLength(1);
      expect(harness.socket.close).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(harness.socket.close).toHaveBeenCalledOnce();
      expect(harness.stop).toHaveBeenCalledOnce();
      expect(harness.audio.close).toHaveBeenCalledOnce();
      expect(harness.events.at(-1)).toEqual({ type: "ENDED" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("performs the same cleanup when disposed during component unmount", async () => {
    const harness = createHarness();
    await harness.controller.start();

    endCleanly(harness);

    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.audio.close).toHaveBeenCalledOnce();
    expect(harness.socket.close).toHaveBeenCalledOnce();
  });

  it("reports microphone permission denial without requesting a token", async () => {
    const requestToken = vi.fn();
    const harness = createHarness({
      requestMicrophone: vi
        .fn()
        .mockRejectedValue(new DOMException("Permission denied", "NotAllowedError")),
      requestToken,
    });

    await expect(harness.controller.start()).resolves.toBe(false);

    expect(requestToken).not.toHaveBeenCalled();
    expect(withoutDiagnostics(harness.events)).toEqual([
      { type: "FAILED", code: "permission-denied" },
    ]);
  });

  it("maps real server events to lifecycle and live-caption events", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "input.speech.started" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "input.speech.stopped" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "transcript.user", text: "Hello" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.started" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "transcript.agent", text: "Hi" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.audio", data: "AA==" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.done", status: "completed" }) });

    expect(withoutDiagnostics(harness.events)).toEqual([
      { type: "SESSION_READY" },
      { type: "USER_SPEECH_STARTED" },
      { type: "USER_SPEECH_STOPPED" },
      { type: "USER_TRANSCRIPT", text: "Hello" },
      { type: "REPLY_STARTED" },
      { type: "AGENT_TRANSCRIPT", text: "Hi" },
      { type: "REPLY_AUDIO" },
      { type: "REPLY_DONE" },
    ]);
    expect(harness.audio.play).toHaveBeenCalledWith("AA==");
    endCleanly(harness);
  });

  it("redacts spoken sensitive data and emits a safe deterministic notice", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);
    const rawValue = "3273000000003210";
    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "transcript.user",
        text: `My Family Card number is ${rawValue}`,
      }),
    });

    const emitted = JSON.stringify(harness.events);
    expect(emitted).not.toContain(rawValue);
    expect(harness.events).toContainEqual({
      type: "USER_TRANSCRIPT",
      text: expect.stringContaining("spoken value was hidden"),
    });
    expect(harness.events).toContainEqual({
      type: "SAFETY_NOTICE",
      message: expect.stringContaining("type sensitive information"),
    });
    endCleanly(harness);
  });

  it("redacts a sensitive value if it appears in an agent caption", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);
    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "transcript.agent",
        text: "Your number is 081234567890.",
      }),
    });

    expect(JSON.stringify(harness.events)).not.toContain("081234567890");
    expect(harness.events.at(-1)).toEqual({
      type: "AGENT_TRANSCRIPT",
      text: expect.stringContaining("spoken value was hidden"),
    });
    endCleanly(harness);
  });

  it("maps the official agent timeout to a recoverable timeout error and cleanup", async () => {
    const harness = createHarness();
    await harness.controller.start();
    harness.socket.onopen?.();
    harness.socket.onmessage?.({
      data: JSON.stringify({ type: "session.error", code: "agent_timeout" }),
    });

    expect(harness.events.at(-1)).toEqual({ type: "FAILED", code: "agent-timeout" });
    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.audio.close).toHaveBeenCalledOnce();
    expect(harness.socket.close).toHaveBeenCalledOnce();
  });

  it("can retry with a fresh token after an agent timeout", async () => {
    const harness = createHarness();
    await harness.controller.start();
    harness.socket.onopen?.();
    harness.socket.onmessage?.({
      data: JSON.stringify({ type: "session.error", code: "agent_timeout" }),
    });

    await expect(harness.controller.start()).resolves.toBe(true);
    expect(harness.runtime.requestToken).toHaveBeenCalledTimes(2);
    endCleanly(harness);
  });

  it("suppresses duplicate semantic context updates", async () => {
    const harness = createHarness();
    expect(harness.controller.updateContext(requirementsContext)).toBe(true);
    expect(harness.controller.updateContext({ ...requirementsContext })).toBe(false);

    await harness.controller.start();
    harness.socket.onopen?.();
    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "session.ready",
        config: voiceSessionConfiguration.session,
      }),
    });

    expect(harness.socket.send).toHaveBeenCalledTimes(2);
    expect(harness.controller.updateContext(requirementsContext)).toBe(false);
    acknowledgeLatestContext(harness);
    expect(harness.events).toContainEqual({ type: "SESSION_READY" });
    expect(harness.socket.send).toHaveBeenCalledTimes(2);
    endCleanly(harness);
  });

  it("configures low-latency English transcription without fixed silence windows", () => {
    const input = voiceSessionConfiguration.session.input;

    expect(input.transcription_mode).toBe("min_latency");
    expect(input.language_codes).toEqual(["en"]);
    expect(input.transcription_prompt).toBe(
      "AksesSuara, BPJS, Family Card, healthcare facility, enrollment, Continue, Previous, Review.",
    );
    expect(input.turn_detection).toEqual({ interrupt_response: true });
    expect(input.turn_detection).not.toHaveProperty("min_silence");
    expect(input.turn_detection).not.toHaveProperty("max_silence");
    expect(JSON.stringify(input)).not.toMatch(/max_accuracy|debounce|delay|sleep/i);
  });

  it("waits for the matching initial context acknowledgement before sending audio", async () => {
    const harness = createHarness();
    harness.controller.updateContext(requirementsContext);
    await harness.controller.start();
    harness.socket.onopen?.();

    harness.pushAudioChunk();
    expect(
      vi.mocked(harness.socket.send).mock.calls.some(([raw]) =>
        String(raw).includes('"type":"input.audio"'),
      ),
    ).toBe(false);

    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "session.ready",
        config: voiceSessionConfiguration.session,
      }),
    });
    harness.pushAudioChunk();
    expect(harness.events).toContainEqual({
      type: "SESSION_CONFIGURATION",
      transcriptionMode: "min_latency",
      englishLanguageSteering: true,
    });
    expect(harness.events).not.toContainEqual({ type: "SESSION_READY" });

    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "session.updated",
        config: { system_prompt: "stale prompt" },
      }),
    });
    harness.pushAudioChunk();
    expect(harness.events).not.toContainEqual({ type: "SESSION_READY" });

    acknowledgeLatestContext(harness);
    harness.pushAudioChunk("AQ==");
    expect(harness.events).toContainEqual({ type: "SESSION_READY" });
    expect(
      vi.mocked(harness.socket.send).mock.calls
        .map(([raw]) => JSON.parse(String(raw)) as { type: string; audio?: string })
        .filter((message) => message.type === "input.audio"),
    ).toEqual([{ type: "input.audio", audio: "AQ==" }]);
    endCleanly(harness);
  });

  it("sends a complete safety baseline and current context in every prompt update", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);
    harness.controller.updateContext(requirementsContext);

    const update = vi.mocked(harness.socket.send).mock.calls
      .map(([raw]) => JSON.parse(String(raw)) as {
        type: string;
        session?: { system_prompt?: string };
      })
      .filter((message) => message.type === "session.update")
      .at(-1);
    const prompt = update?.session?.system_prompt ?? "";

    expect(prompt).toContain("CURRENT SCREEN CONTEXT");
    expect(prompt).toContain("Screen identifier: requirements");
    expect(prompt).toContain("Never ask the user to speak");
    expect(prompt).toContain("solve or bypass CAPTCHA");
    expect(prompt).toContain("application state machine is authoritative");
    endCleanly(harness);
  });

  it("does not send context updates for incomplete keystrokes with unchanged semantics", () => {
    const harness = createHarness();
    const family = {
      ...createInitialEnrollmentState(),
      screenId: "family-information" as const,
    };
    const oneDigit = enrollmentReducer(family, {
      type: "UPDATE_FIELD",
      fieldId: "familyCardNumber",
      value: "3",
    });
    const twoDigits = enrollmentReducer(oneDigit, {
      type: "UPDATE_FIELD",
      fieldId: "familyCardNumber",
      value: "32",
    });

    expect(
      harness.controller.updateContext(createEnrollmentScreenContext(oneDigit)),
    ).toBe(true);
    expect(
      harness.controller.updateContext(createEnrollmentScreenContext(twoDigits)),
    ).toBe(false);
  });

  it("queues only the latest context until session.ready and configuration acknowledgement", async () => {
    const harness = createHarness();
    harness.controller.updateContext(welcomeContext);
    harness.controller.updateContext(requirementsContext);

    await harness.controller.start();
    harness.socket.onopen?.();
    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "session.ready",
        config: voiceSessionConfiguration.session,
      }),
    });
    expect(harness.socket.send).toHaveBeenCalledTimes(2);
    const update = JSON.parse(
      String(vi.mocked(harness.socket.send).mock.calls[1][0]),
    ) as { session: { system_prompt: string } };
    expect(update.session.system_prompt).toContain("Screen identifier: requirements");
    expect(update.session.system_prompt).not.toContain("Screen identifier: welcome");
    acknowledgeLatestContext(harness);
    expect(harness.events).toContainEqual({ type: "SESSION_READY" });
    endCleanly(harness);
  });

  it("serializes rapid updates so stale context cannot overtake the latest context", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);
    const familyState = {
      ...createInitialEnrollmentState(),
      screenId: "family-information" as const,
    };
    const participantState = {
      ...createInitialEnrollmentState(),
      screenId: "participant-information" as const,
    };

    harness.controller.updateContext(createEnrollmentScreenContext(familyState));
    harness.controller.updateContext(createEnrollmentScreenContext(participantState));
    expect(harness.socket.send).toHaveBeenCalledTimes(3);

    acknowledgeLatestContext(harness);
    expect(harness.socket.send).toHaveBeenCalledTimes(4);
    const latest = JSON.parse(
      String(vi.mocked(harness.socket.send).mock.calls[3][0]),
    ) as { session: { system_prompt: string } };
    expect(latest.session.system_prompt).toContain(
      "Screen identifier: participant-information",
    );

    acknowledgeLatestContext(harness);
    acknowledgeLatestContext(harness);
    expect(harness.socket.send).toHaveBeenCalledTimes(4);
    endCleanly(harness);
  });

  it("does not mutate enrollment state while synchronizing context", async () => {
    const harness = createHarness();
    const state = enrollmentReducer(createInitialEnrollmentState(), {
      type: "START_MANUAL",
    });
    const before = JSON.stringify(state);

    harness.controller.updateContext(createEnrollmentScreenContext(state));

    expect(JSON.stringify(state)).toBe(before);
    endCleanly(harness);
  });

  it("declares only the fixed allowlisted tools in the initial session update", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);

    const messages = vi.mocked(harness.socket.send).mock.calls.map(([raw]) =>
      JSON.parse(String(raw)) as { session?: { tools?: unknown; system_prompt?: string } },
    );
    expect(
      (messages[0].session?.tools as Array<{ name: string }>).map(({ name }) => name),
    ).toEqual([
      "explain_current_screen",
      "highlight_field",
      "validate_current_step",
      "go_to_next_step",
      "go_to_previous_step",
      "repeat_instruction",
      "set_speech_preference",
      "show_review",
    ]);
    expect(messages[1].session).toEqual({
      system_prompt: expect.any(String),
    });
    expect(messages.every((message) => message.session?.tools === undefined || Array.isArray(message.session.tools))).toBe(true);
    endCleanly(harness);
  });

  it("executes a tool at most once and sends its result only after reply.done", async () => {
    const handleTool = vi.fn<VoiceToolHandler>().mockReturnValue({
      result: { status: "success", screenId: "requirements" },
      feedback: "Requirements explained.",
    });
    const harness = createHarness({}, handleTool);
    await makeGuidanceReady(harness);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.started" }) });
    const toolCall = {
      type: "tool.call",
      call_id: "call-one",
      name: "explain_current_screen",
      arguments: {},
    };

    harness.socket.onmessage?.({ data: JSON.stringify(toolCall) });
    harness.socket.onmessage?.({ data: JSON.stringify(toolCall) });
    expect(handleTool).not.toHaveBeenCalled();

    harness.socket.onmessage?.({
      data: JSON.stringify({ type: "reply.done", status: "completed" }),
    });

    expect(handleTool).toHaveBeenCalledOnce();
    expect(handleTool.mock.calls[0][0]).toMatchObject({
      callId: "call-one",
      name: "explain_current_screen",
      arguments: {},
      expectedContextKey: expect.any(String),
    });
    const resultMessages = vi.mocked(harness.socket.send).mock.calls
      .map(([raw]) => JSON.parse(String(raw)) as { type: string; result?: string })
      .filter((message) => message.type === "tool.result");
    expect(resultMessages).toHaveLength(1);
    expect(JSON.parse(resultMessages[0].result!)).toEqual({
      status: "success",
      screenId: "requirements",
    });
    expect(harness.events).toContainEqual({
      type: "TOOL_FEEDBACK",
      message: "Requirements explained.",
    });
    endCleanly(harness);
  });

  it("drops an interrupted pending call before it can mutate application state", async () => {
    const handleTool = vi.fn<VoiceToolHandler>();
    const harness = createHarness({}, handleTool);
    await makeGuidanceReady(harness);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.started" }) });
    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "tool.call",
        call_id: "interrupted-call",
        name: "go_to_next_step",
        arguments: {},
      }),
    });
    harness.socket.onmessage?.({
      data: JSON.stringify({ type: "reply.done", status: "interrupted" }),
    });

    expect(handleTool).not.toHaveBeenCalled();
    expect(
      vi.mocked(harness.socket.send).mock.calls.some(([raw]) =>
        String(raw).includes("interrupted-call"),
      ),
    ).toBe(false);
    endCleanly(harness);
  });

  it("returns a blocked tool result without terminating the voice session", async () => {
    const handleTool = vi.fn<VoiceToolHandler>().mockReturnValue({
      result: {
        status: "blocked",
        code: "invalid_arguments",
        message: "That voice action used invalid information and was not applied.",
      },
      feedback: "That voice action was not applied.",
    });
    const harness = createHarness({}, handleTool);
    await makeGuidanceReady(harness);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.started" }) });
    harness.socket.onmessage?.({
      data: JSON.stringify({
        type: "tool.call",
        call_id: "bad-call",
        name: "highlight_field",
        arguments: { fieldId: 42 },
      }),
    });
    harness.socket.onmessage?.({
      data: JSON.stringify({ type: "reply.done", status: "completed" }),
    });

    const toolResult = vi.mocked(harness.socket.send).mock.calls
      .map(([raw]) => JSON.parse(String(raw)) as { type: string; is_error?: boolean })
      .find((message) => message.type === "tool.result");
    expect(toolResult?.is_error).toBe(true);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "input.speech.started" }) });
    expect(harness.events.at(-1)).toEqual({ type: "USER_SPEECH_STARTED" });
    expect(harness.stop).not.toHaveBeenCalled();
    endCleanly(harness);
  });
});

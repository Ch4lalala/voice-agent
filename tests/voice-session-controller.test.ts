import { describe, expect, it, vi } from "vitest";

import {
  VoiceSessionController,
  type VoiceAudioSession,
  type VoiceMediaStream,
  type VoiceRuntime,
  type VoiceSocket,
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

function createHarness(overrides: Partial<VoiceRuntime> = {}) {
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
  const runtime: VoiceRuntime = {
    requestMicrophone: vi.fn().mockResolvedValue(stream),
    requestToken: vi.fn().mockResolvedValue("temporary-token"),
    createAudioSession: vi.fn().mockResolvedValue(audio),
    createSocket: vi.fn().mockReturnValue(socket),
    ...overrides,
  };
  const events: VoiceClientEvent[] = [];
  const controller = new VoiceSessionController(runtime, (event) => events.push(event));
  return { audio, controller, events, runtime, socket, stop, stream };
}

const welcomeContext = createEnrollmentScreenContext(createInitialEnrollmentState());
const requirementsContext = createEnrollmentScreenContext(
  enrollmentReducer(createInitialEnrollmentState(), { type: "START_MANUAL" }),
);

async function makeGuidanceReady(harness: ReturnType<typeof createHarness>) {
  harness.controller.updateContext(welcomeContext);
  await harness.controller.start();
  harness.socket.onopen?.();
  harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ready" }) });
  harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
  harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
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
    harness.controller.dispose();
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
    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.audio.close).toHaveBeenCalledOnce();
    expect(harness.socket.close).toHaveBeenCalledOnce();
    expect(harness.socket.onmessage).toBeNull();
    expect(harness.events.at(-1)).toEqual({ type: "ENDED" });
  });

  it("performs the same cleanup when disposed during component unmount", async () => {
    const harness = createHarness();
    await harness.controller.start();

    harness.controller.dispose();

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
    expect(harness.events).toEqual([
      { type: "FAILED", code: "permission-denied" },
    ]);
  });

  it("maps real server events to lifecycle and live-caption events", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "input.speech.started" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "transcript.user", text: "Hello" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "input.speech.stopped" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.started" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "transcript.agent", text: "Hi" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.audio", data: "AA==" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "reply.done", status: "completed" }) });

    expect(harness.events).toEqual([
      { type: "SESSION_READY" },
      { type: "USER_SPEECH_STARTED" },
      { type: "USER_TRANSCRIPT", text: "Hello" },
      { type: "USER_SPEECH_STOPPED" },
      { type: "REPLY_STARTED" },
      { type: "AGENT_TRANSCRIPT", text: "Hi" },
      { type: "REPLY_AUDIO" },
      { type: "REPLY_DONE" },
    ]);
    expect(harness.audio.play).toHaveBeenCalledWith("AA==");
    harness.controller.dispose();
  });

  it("suppresses duplicate semantic context updates", async () => {
    const harness = createHarness();
    expect(harness.controller.updateContext(requirementsContext)).toBe(true);
    expect(harness.controller.updateContext({ ...requirementsContext })).toBe(false);

    await harness.controller.start();
    harness.socket.onopen?.();
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ready" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });

    expect(harness.socket.send).toHaveBeenCalledTimes(2);
    expect(harness.controller.updateContext(requirementsContext)).toBe(false);
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
    expect(harness.events).toContainEqual({ type: "SESSION_READY" });
    expect(harness.socket.send).toHaveBeenCalledTimes(2);
    harness.controller.dispose();
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
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ready" }) });
    expect(harness.socket.send).toHaveBeenCalledTimes(1);

    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
    expect(harness.socket.send).toHaveBeenCalledTimes(2);
    const update = JSON.parse(
      String(vi.mocked(harness.socket.send).mock.calls[1][0]),
    ) as { session: { system_prompt: string } };
    expect(update.session.system_prompt).toContain("Screen identifier: requirements");
    expect(update.session.system_prompt).not.toContain("Screen identifier: welcome");
    harness.controller.dispose();
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

    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
    expect(harness.socket.send).toHaveBeenCalledTimes(4);
    const latest = JSON.parse(
      String(vi.mocked(harness.socket.send).mock.calls[3][0]),
    ) as { session: { system_prompt: string } };
    expect(latest.session.system_prompt).toContain(
      "Screen identifier: participant-information",
    );

    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.updated" }) });
    expect(harness.socket.send).toHaveBeenCalledTimes(4);
    harness.controller.dispose();
  });

  it("does not mutate enrollment state while synchronizing context", async () => {
    const harness = createHarness();
    const state = enrollmentReducer(createInitialEnrollmentState(), {
      type: "START_MANUAL",
    });
    const before = JSON.stringify(state);

    harness.controller.updateContext(createEnrollmentScreenContext(state));

    expect(JSON.stringify(state)).toBe(before);
    harness.controller.dispose();
  });

  it("keeps every session update free of agent tool definitions", async () => {
    const harness = createHarness();
    await makeGuidanceReady(harness);

    const messages = vi.mocked(harness.socket.send).mock.calls.map(([raw]) =>
      JSON.parse(String(raw)) as { session?: { tools?: unknown; system_prompt?: string } },
    );
    expect(messages[0].session?.tools).toEqual([]);
    expect(messages[1].session).toEqual({
      system_prompt: expect.any(String),
    });
    expect(messages.every((message) => message.session?.tools === undefined || Array.isArray(message.session.tools))).toBe(true);
    harness.controller.dispose();
  });
});

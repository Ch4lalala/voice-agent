import { describe, expect, it, vi } from "vitest";

import {
  VoiceSessionController,
  type VoiceAudioSession,
  type VoiceMediaStream,
  type VoiceRuntime,
  type VoiceSocket,
} from "../src/lib/voice-agent-client";
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
    await harness.controller.start();
    harness.socket.onmessage?.({ data: JSON.stringify({ type: "session.ready" }) });
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
});

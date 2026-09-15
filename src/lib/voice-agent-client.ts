import type { VoiceClientEvent, VoiceErrorCode } from "@/types/voice";

const VOICE_WEBSOCKET_URL = "wss://agents.assemblyai.com/v1/ws";
const PCM_SAMPLE_RATE = 24_000;

export const voiceSessionConfiguration = {
  type: "session.update",
  session: {
    system_prompt:
      "You are AksesSuara, a calm English voice guide in an independent hackathon prototype. Hold a brief general conversation in plain English, using one or two short sentences at a time. You do not know the current screen and cannot navigate, validate, choose, submit, or call tools. Do not ask for or repeat identification numbers, Family Card numbers, phone numbers, medical details, or other sensitive data. If the user mentions enrollment, tell them to use the visible manual controls. Never claim official BPJS Kesehatan affiliation or provide medical, legal, or eligibility advice.",
    greeting:
      "Hello. I’m AksesSuara. We can have a short conversation while you use the on-screen controls yourself.",
    tools: [],
    input: {
      format: { encoding: "audio/pcm" },
      language_codes: ["en"],
      turn_detection: { interrupt_response: true },
    },
    output: {
      voice: "ivy",
      format: { encoding: "audio/pcm" },
    },
  },
} as const;

export interface VoiceTrack {
  stop(): void;
}

export interface VoiceMediaStream {
  getTracks(): VoiceTrack[];
}

export interface VoiceSocket {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface VoiceAudioSession {
  play(base64Audio: string): void;
  interrupt(): void;
  close(): void | Promise<void>;
}

export interface VoiceRuntime {
  requestMicrophone(): Promise<VoiceMediaStream>;
  requestToken(signal: AbortSignal): Promise<string>;
  createAudioSession(
    stream: VoiceMediaStream,
    onAudioChunk: (base64Audio: string) => void,
  ): Promise<VoiceAudioSession>;
  createSocket(token: string): VoiceSocket;
}

type ControllerPhase = "idle" | "starting" | "active";

function classifyFailure(error: unknown): VoiceErrorCode {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "permission-denied";
  }
  if (error instanceof Error && error.message === "voice-not-configured") {
    return "not-configured";
  }
  if (error instanceof Error && error.message === "voice-not-supported") {
    return "not-supported";
  }
  return "connection-failed";
}

function safeParseMessage(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") return null;
  try {
    const value: unknown = JSON.parse(data);
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export class VoiceSessionController {
  private phase: ControllerPhase = "idle";
  private generation = 0;
  private stream: VoiceMediaStream | null = null;
  private socket: VoiceSocket | null = null;
  private audio: VoiceAudioSession | null = null;
  private abortController: AbortController | null = null;
  private sessionReady = false;

  constructor(
    private readonly runtime: VoiceRuntime,
    private readonly emit: (event: VoiceClientEvent) => void,
  ) {}

  async start(): Promise<boolean> {
    if (this.phase !== "idle") return false;

    this.phase = "starting";
    const generation = ++this.generation;
    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      const stream = await this.runtime.requestMicrophone();
      if (!this.isCurrent(generation)) {
        stopStream(stream);
        return false;
      }
      this.stream = stream;

      const token = await this.runtime.requestToken(abortController.signal);
      if (!this.isCurrent(generation)) return false;

      const audioSession = await this.runtime.createAudioSession(stream, (audio) => {
        if (!this.isCurrent(generation) || !this.sessionReady) return;
        this.send({ type: "input.audio", audio });
      });
      if (!this.isCurrent(generation)) {
        void audioSession.close();
        return false;
      }
      this.audio = audioSession;

      const socket = this.runtime.createSocket(token);
      this.socket = socket;
      socket.onopen = () => {
        if (!this.isCurrent(generation)) return;
        this.send(voiceSessionConfiguration);
      };
      socket.onmessage = (event) => this.handleMessage(generation, event.data);
      socket.onerror = () => this.fail(generation, "connection-failed");
      socket.onclose = () => {
        if (this.isCurrent(generation)) this.fail(generation, "connection-failed");
      };
      this.phase = "active";
      return true;
    } catch (error) {
      if (this.isCurrent(generation)) this.fail(generation, classifyFailure(error));
      return false;
    }
  }

  end(): void {
    if (this.phase === "idle") return;
    this.generation += 1;
    this.send({ type: "session.end" });
    this.releaseResources();
    this.phase = "idle";
    this.emit({ type: "ENDED" });
  }

  dispose(): void {
    this.end();
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation && this.phase !== "idle";
  }

  private send(message: object): void {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message));
  }

  private handleMessage(generation: number, data: unknown): void {
    if (!this.isCurrent(generation)) return;
    const message = safeParseMessage(data);
    if (!message || typeof message.type !== "string") return;

    switch (message.type) {
      case "session.ready":
        this.sessionReady = true;
        this.emit({ type: "SESSION_READY" });
        break;
      case "input.speech.started":
        this.audio?.interrupt();
        this.emit({ type: "USER_SPEECH_STARTED" });
        break;
      case "input.speech.stopped":
        this.emit({ type: "USER_SPEECH_STOPPED" });
        break;
      case "transcript.user.delta":
      case "transcript.user":
        if (typeof message.text === "string") {
          this.emit({ type: "USER_TRANSCRIPT", text: message.text });
        }
        break;
      case "reply.started":
        this.emit({ type: "REPLY_STARTED" });
        break;
      case "reply.audio":
        if (typeof message.data === "string") {
          this.emit({ type: "REPLY_AUDIO" });
          this.audio?.play(message.data);
        }
        break;
      case "transcript.agent":
        if (typeof message.text === "string") {
          this.emit({ type: "AGENT_TRANSCRIPT", text: message.text });
        }
        break;
      case "reply.done":
        if (message.status === "interrupted") this.audio?.interrupt();
        this.emit({ type: "REPLY_DONE" });
        break;
      case "session.ended":
        this.finish(generation);
        break;
      case "session.error":
        this.fail(generation, "connection-failed");
        break;
      default:
        break;
    }
  }

  private finish(generation: number): void {
    if (!this.isCurrent(generation)) return;
    this.generation += 1;
    this.releaseResources();
    this.phase = "idle";
    this.emit({ type: "ENDED" });
  }

  private fail(generation: number, code: VoiceErrorCode): void {
    if (!this.isCurrent(generation)) return;
    this.generation += 1;
    this.releaseResources();
    this.phase = "idle";
    this.emit({ type: "FAILED", code });
  }

  private releaseResources(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.sessionReady = false;

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }

    const audio = this.audio;
    this.audio = null;
    if (audio) void audio.close();

    if (this.stream) stopStream(this.stream);
    this.stream = null;
  }
}

function stopStream(stream: VoiceMediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToPcm(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const view = new DataView(bytes.buffer);
  const pcm = new Int16Array(Math.floor(bytes.length / 2));
  for (let index = 0; index < pcm.length; index += 1) {
    pcm[index] = view.getInt16(index * 2, true);
  }
  return pcm;
}

class BrowserAudioSession implements VoiceAudioSession {
  private readonly captureContext: AudioContext;
  private readonly playbackContext: AudioContext;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly worklet: AudioWorkletNode;
  private readonly silentGain: GainNode;
  private readonly playingSources = new Set<AudioBufferSourceNode>();
  private playbackTime = 0;

  static async create(
    stream: MediaStream,
    onAudioChunk: (base64Audio: string) => void,
  ): Promise<BrowserAudioSession> {
    const captureContext = new AudioContext();
    const playbackContext = new AudioContext();
    await captureContext.audioWorklet.addModule("/audio/pcm-capture-worklet.js");
    const source = captureContext.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(captureContext, "pcm-capture-processor", {
      processorOptions: {
        inputSampleRate: captureContext.sampleRate,
        targetSampleRate: PCM_SAMPLE_RATE,
        chunkSamples: 1_200,
      },
    });
    const silentGain = captureContext.createGain();
    silentGain.gain.value = 0;
    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      onAudioChunk(bytesToBase64(new Uint8Array(event.data)));
    };
    source.connect(worklet).connect(silentGain).connect(captureContext.destination);
    await Promise.all([captureContext.resume(), playbackContext.resume()]);
    return new BrowserAudioSession(
      captureContext,
      playbackContext,
      source,
      worklet,
      silentGain,
    );
  }

  private constructor(
    captureContext: AudioContext,
    playbackContext: AudioContext,
    source: MediaStreamAudioSourceNode,
    worklet: AudioWorkletNode,
    silentGain: GainNode,
  ) {
    this.captureContext = captureContext;
    this.playbackContext = playbackContext;
    this.source = source;
    this.worklet = worklet;
    this.silentGain = silentGain;
  }

  play(base64Audio: string): void {
    const pcm = base64ToPcm(base64Audio);
    const floats = new Float32Array(pcm.length);
    for (let index = 0; index < pcm.length; index += 1) {
      floats[index] = pcm[index] / 32_768;
    }
    const buffer = this.playbackContext.createBuffer(1, floats.length, PCM_SAMPLE_RATE);
    buffer.copyToChannel(floats, 0);
    const source = this.playbackContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackContext.destination);
    const startsAt = Math.max(this.playbackTime, this.playbackContext.currentTime);
    source.start(startsAt);
    this.playbackTime = startsAt + buffer.duration;
    this.playingSources.add(source);
    source.onended = () => this.playingSources.delete(source);
  }

  interrupt(): void {
    for (const source of this.playingSources) {
      try {
        source.stop();
      } catch {
        // A source can already have completed between iteration and stop.
      }
    }
    this.playingSources.clear();
    this.playbackTime = this.playbackContext.currentTime;
  }

  async close(): Promise<void> {
    this.interrupt();
    this.worklet.port.onmessage = null;
    this.source.disconnect();
    this.worklet.disconnect();
    this.silentGain.disconnect();
    await Promise.allSettled([
      this.captureContext.close(),
      this.playbackContext.close(),
    ]);
  }
}

export function createBrowserVoiceRuntime(): VoiceRuntime {
  return {
    async requestMicrophone() {
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
        throw new Error("voice-not-supported");
      }
      return navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    },
    async requestToken(signal) {
      const response = await fetch("/api/voice/token", {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        if (response.status === 503) throw new Error("voice-not-configured");
        throw new Error("voice-token-failed");
      }
      const value: unknown = await response.json();
      if (
        typeof value !== "object" ||
        value === null ||
        typeof (value as { token?: unknown }).token !== "string"
      ) {
        throw new Error("voice-token-failed");
      }
      return (value as { token: string }).token;
    },
    async createAudioSession(stream, onAudioChunk) {
      return BrowserAudioSession.create(stream as MediaStream, onAudioChunk);
    },
    createSocket(token) {
      const url = new URL(VOICE_WEBSOCKET_URL);
      url.searchParams.set("token", token);
      return new WebSocket(url) as VoiceSocket;
    },
  };
}

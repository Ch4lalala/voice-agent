import { createVoiceContextSnapshot, voiceAgentPromptBaseline } from "@/lib/voice-context";
import {
  VoiceLatencyTracker,
  type VoiceLatencyMetric,
} from "@/lib/voice-latency";
import { getVoiceSafetyNotice, sanitizeVoiceCaption } from "@/lib/voice-safety";
import { voiceToolDefinitions, type VoiceToolCall, type VoiceToolExecution } from "@/lib/voice-tools";
import type { EnrollmentScreenContext } from "@/types/enrollment";
import type { VoiceClientEvent, VoiceErrorCode } from "@/types/voice";

const VOICE_WEBSOCKET_URL = "wss://agents.assemblyai.com/v1/ws";
const PCM_SAMPLE_RATE = 24_000;
const SESSION_END_TIMEOUT_MS = 1_000;

export const voiceSessionConfiguration = {
  type: "session.update",
  session: {
    system_prompt:
      voiceAgentPromptBaseline,
    greeting:
      "Hello. I’m AksesSuara. We can have a short conversation while you use the on-screen controls yourself.",
    tools: voiceToolDefinitions,
    input: {
      format: { encoding: "audio/pcm" },
      transcription_mode: "min_latency",
      transcription_prompt:
        "AksesSuara, BPJS, Family Card, healthcare facility, enrollment, Continue, Previous, Review.",
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

type ControllerPhase = "idle" | "starting" | "active" | "ending";

export type VoiceToolHandler = (call: VoiceToolCall) => VoiceToolExecution;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolvedConfigurationMetadata(message: Record<string, unknown>): {
  transcriptionMode: "min_latency" | "balanced" | "max_accuracy" | "unknown";
  englishLanguageSteering: boolean;
} | null {
  if (!isRecord(message.config) || !isRecord(message.config.input)) return null;
  const input = message.config.input;
  const transcriptionMode =
    input.transcription_mode === "min_latency" ||
    input.transcription_mode === "balanced" ||
    input.transcription_mode === "max_accuracy"
      ? input.transcription_mode
      : "unknown";
  const englishLanguageSteering =
    Array.isArray(input.language_codes) && input.language_codes.includes("en");
  return { transcriptionMode, englishLanguageSteering };
}

function acknowledgedSystemPrompt(message: Record<string, unknown>): string | null {
  return isRecord(message.config) && typeof message.config.system_prompt === "string"
    ? message.config.system_prompt
    : null;
}

export class VoiceSessionController {
  private phase: ControllerPhase = "idle";
  private generation = 0;
  private stream: VoiceMediaStream | null = null;
  private socket: VoiceSocket | null = null;
  private audio: VoiceAudioSession | null = null;
  private abortController: AbortController | null = null;
  private providerSessionReady = false;
  private guidanceReady = false;
  private socketOpened = false;
  private sessionEndSent = false;
  private sessionEndTimer: ReturnType<typeof setTimeout> | null = null;
  private latestContext: ReturnType<typeof createVoiceContextSnapshot> | null = null;
  private contextUpdateInFlight: ReturnType<typeof createVoiceContextSnapshot> | null = null;
  private appliedContextKey: string | null = null;
  private lastProtocolEvent: string | null = null;
  private pendingToolCalls: VoiceToolCall[] = [];
  private handledToolCallIds = new Set<string>();
  private readonly latency = new VoiceLatencyTracker();

  constructor(
    private readonly runtime: VoiceRuntime,
    private readonly emit: (event: VoiceClientEvent) => void,
    private readonly handleTool?: VoiceToolHandler,
    private readonly diagnosticsEnabled = process.env.NODE_ENV === "development",
  ) {}

  updateContext(context: EnrollmentScreenContext): boolean {
    const snapshot = createVoiceContextSnapshot(context);
    if (snapshot.semanticKey === this.latestContext?.semanticKey) return false;

    this.latestContext = snapshot;
    this.sendLatestContextIfReady();
    return true;
  }

  async start(): Promise<boolean> {
    if (this.phase !== "idle") return false;

    this.phase = "starting";
    if (this.diagnosticsEnabled) this.latency.reset();
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
        if (!this.isCurrent(generation) || !this.guidanceReady) return;
        if (this.diagnosticsEnabled) this.latency.recordInputAudio();
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
        this.socketOpened = true;
        this.send(voiceSessionConfiguration);
      };
      socket.onmessage = (event) => this.handleMessage(generation, event.data);
      socket.onerror = () => {
        if (this.phase === "ending") this.completeEnd();
        else this.fail(generation, "connection-failed");
      };
      socket.onclose = () => {
        if (!this.isCurrent(generation)) return;
        if (this.phase === "ending") this.completeEnd();
        else this.fail(generation, "connection-failed");
      };
      this.phase = "active";
      return true;
    } catch (error) {
      if (this.isCurrent(generation)) this.fail(generation, classifyFailure(error));
      return false;
    }
  }

  end(): void {
    if (this.phase === "idle" || this.phase === "ending") return;
    this.phase = "ending";
    this.guidanceReady = false;
    this.pendingToolCalls = [];
    this.audio?.interrupt();

    if (this.socketOpened && this.socket?.readyState === 1) {
      if (!this.sessionEndSent) {
        this.sessionEndSent = true;
        this.send({ type: "session.end" });
      }
      this.sessionEndTimer = setTimeout(
        () => this.completeEnd(),
        SESSION_END_TIMEOUT_MS,
      );
      return;
    }

    this.completeEnd();
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

    if (message.type === "session.ended") {
      this.completeEnd();
      return;
    }
    if (this.phase === "ending") return;

    switch (message.type) {
      case "session.ready":
        this.providerSessionReady = true;
        this.emitResolvedConfiguration(message);
        this.sendLatestContextIfReady();
        break;
      case "session.updated":
        this.handleSessionUpdated(message);
        break;
      case "input.speech.started":
        this.lastProtocolEvent = message.type;
        this.audio?.interrupt();
        this.emit({ type: "USER_SPEECH_STARTED" });
        break;
      case "input.speech.stopped":
        if (this.diagnosticsEnabled) {
          this.emitLatency(this.latency.recordSpeechStopped());
        }
        this.emit({ type: "USER_SPEECH_STOPPED" });
        break;
      case "transcript.user.delta":
      case "transcript.user":
        if (typeof message.text === "string") {
          const caption = sanitizeVoiceCaption(
            message.text,
            "user",
            message.type === "transcript.user.delta",
          );
          this.emit({ type: "USER_TRANSCRIPT", text: caption.text });
          if (message.type === "transcript.user") {
            if (this.diagnosticsEnabled) {
              this.emitLatency(this.latency.recordFinalTranscript());
            }
            const notice = getVoiceSafetyNotice(message.text);
            if (notice) this.emit({ type: "SAFETY_NOTICE", message: notice });
          }
        }
        break;
      case "reply.started":
        if (this.diagnosticsEnabled) {
          for (const metric of this.latency.recordReplyStarted()) {
            this.emitLatency(metric);
          }
        }
        this.lastProtocolEvent = message.type;
        this.emit({ type: "REPLY_STARTED" });
        break;
      case "reply.audio":
        if (typeof message.data === "string") {
          if (this.diagnosticsEnabled) {
            this.emitLatency(this.latency.recordFirstReplyAudio());
          }
          this.emit({ type: "REPLY_AUDIO" });
          this.audio?.play(message.data);
        }
        break;
      case "transcript.agent":
        if (typeof message.text === "string") {
          this.emit({
            type: "AGENT_TRANSCRIPT",
            text: sanitizeVoiceCaption(message.text, "agent").text,
          });
        }
        break;
      case "reply.done":
        if (this.diagnosticsEnabled) {
          this.emitLatency(this.latency.recordReplyDone());
        }
        this.lastProtocolEvent = message.type;
        if (message.status === "interrupted") this.audio?.interrupt();
        if (message.status === "interrupted") this.pendingToolCalls = [];
        else this.flushPendingToolCalls();
        this.emit({ type: "REPLY_DONE" });
        break;
      case "tool.call":
        this.queueToolCall(message);
        break;
      case "session.error":
        this.fail(
          generation,
          message.code === "agent_timeout" ? "agent-timeout" : "connection-failed",
        );
        break;
      default:
        break;
    }
  }

  private fail(generation: number, code: VoiceErrorCode): void {
    if (!this.isCurrent(generation)) return;
    this.generation += 1;
    this.releaseResources();
    this.phase = "idle";
    this.emit({ type: "FAILED", code });
  }

  private completeEnd(): void {
    if (this.phase === "idle") return;
    this.generation += 1;
    this.releaseResources();
    this.phase = "idle";
    this.emit({ type: "ENDED" });
  }

  private releaseResources(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.providerSessionReady = false;
    this.guidanceReady = false;
    this.socketOpened = false;
    this.sessionEndSent = false;
    if (this.sessionEndTimer) clearTimeout(this.sessionEndTimer);
    this.sessionEndTimer = null;
    this.contextUpdateInFlight = null;
    this.appliedContextKey = null;
    this.lastProtocolEvent = null;
    this.pendingToolCalls = [];
    this.handledToolCallIds.clear();

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

  private handleSessionUpdated(message: Record<string, unknown>): void {
    if (!this.contextUpdateInFlight) return;
    if (
      acknowledgedSystemPrompt(message) !==
      this.contextUpdateInFlight.systemPrompt
    ) {
      return;
    }

    this.appliedContextKey = this.contextUpdateInFlight.semanticKey;
    this.contextUpdateInFlight = null;

    if (this.latestContext?.semanticKey !== this.appliedContextKey) {
      this.sendLatestContextIfReady();
      return;
    }

    if (!this.guidanceReady) {
      this.guidanceReady = true;
      this.emit({ type: "SESSION_READY" });
    }
  }

  private sendLatestContextIfReady(): void {
    if (
      this.phase !== "active" ||
      !this.providerSessionReady ||
      this.contextUpdateInFlight ||
      !this.latestContext ||
      this.latestContext.semanticKey === this.appliedContextKey
    ) {
      return;
    }

    this.contextUpdateInFlight = this.latestContext;
    this.send({
      type: "session.update",
      session: { system_prompt: this.latestContext.systemPrompt },
    });
  }

  private queueToolCall(message: Record<string, unknown>): void {
    if (typeof message.call_id !== "string" || typeof message.name !== "string") return;
    if (this.handledToolCallIds.has(message.call_id)) return;

    this.handledToolCallIds.add(message.call_id);
    if (this.diagnosticsEnabled) this.latency.recordToolCall();
    this.pendingToolCalls.push({
      callId: message.call_id,
      name: message.name,
      arguments: message.arguments,
      expectedContextKey: this.appliedContextKey,
    });
    this.flushPendingToolCalls();
  }

  private flushPendingToolCalls(): void {
    if (this.lastProtocolEvent !== "reply.done" || !this.pendingToolCalls.length) return;

    while (this.pendingToolCalls.length && this.lastProtocolEvent === "reply.done") {
      const call = this.pendingToolCalls.shift()!;
      let execution: VoiceToolExecution;
      try {
        execution = this.handleTool
          ? this.handleTool(call)
          : {
              result: {
                status: "blocked",
                code: "handler_unavailable",
                message: "That voice action is temporarily unavailable.",
              },
              feedback: "That voice action is temporarily unavailable.",
            };
      } catch {
        execution = {
          result: {
            status: "blocked",
            code: "tool_failed",
            message: "That voice action could not be completed. Please try again.",
          },
          feedback: "That voice action could not be completed.",
        };
      }

      this.send({
        type: "tool.result",
        call_id: call.callId,
        result: JSON.stringify(execution.result),
        is_error: execution.result.status === "blocked",
      });
      if (this.diagnosticsEnabled) {
        this.emitLatency(this.latency.recordToolResult());
      }
      this.emit({ type: "TOOL_FEEDBACK", message: execution.feedback });
    }
  }

  private emitLatency(metric: VoiceLatencyMetric | null): void {
    if (metric) this.emit({ type: "LATENCY_METRIC", metric });
  }

  private emitResolvedConfiguration(message: Record<string, unknown>): void {
    if (!this.diagnosticsEnabled) return;
    const metadata = resolvedConfigurationMetadata(message);
    if (!metadata) return;
    this.emit({ type: "SESSION_CONFIGURATION", ...metadata });
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

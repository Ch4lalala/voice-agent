"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  createBrowserVoiceRuntime,
  type InitialGreetingCompleteHandler,
  type VoiceToolHandler,
  VoiceSessionController,
} from "@/lib/voice-agent-client";
import { initialVoiceState, voiceStateReducer } from "@/lib/voice-state";
import type { EnrollmentScreenContext } from "@/types/enrollment";
import type { VoiceState } from "@/types/voice";

type VoiceGuideContextValue = {
  state: VoiceState;
  start: () => void;
  end: () => void;
  syncContext: (context: EnrollmentScreenContext) => void;
  registerToolHandler: (handler: VoiceToolHandler | null) => void;
  registerInitialGreetingHandler: (
    handler: InitialGreetingCompleteHandler | null,
  ) => void;
};

const VoiceGuideContext = createContext<VoiceGuideContextValue | null>(null);

export function VoiceGuideProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(voiceStateReducer, initialVoiceState);
  const controllerRef = useRef<VoiceSessionController | null>(null);
  const latestContextRef = useRef<EnrollmentScreenContext | null>(null);
  const toolHandlerRef = useRef<VoiceToolHandler | null>(null);
  const initialGreetingHandlerRef =
    useRef<InitialGreetingCompleteHandler | null>(null);

  const ensureController = useCallback(() => {
    if (controllerRef.current) return controllerRef.current;

    const controller = new VoiceSessionController(
      createBrowserVoiceRuntime(),
      dispatch,
      (call) => {
        const handler = toolHandlerRef.current;
        if (!handler) {
          return {
            result: {
              status: "blocked",
              is_error: true,
              code: "handler_unavailable",
              message: "That voice action is temporarily unavailable.",
            },
            feedback: "That voice action is temporarily unavailable.",
          };
        }
        return handler(call);
      },
      () => initialGreetingHandlerRef.current?.() ?? false,
    );
    controllerRef.current = controller;
    if (latestContextRef.current) controller.updateContext(latestContextRef.current);
    return controller;
  }, []);

  useEffect(() => {
    const controller = ensureController();

    const endForPageExit = () => controller.dispose();
    window.addEventListener("pagehide", endForPageExit);

    return () => {
      window.removeEventListener("pagehide", endForPageExit);
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [ensureController]);

  const start = useCallback(() => {
    if (state.status !== "off" && state.status !== "error") return;
    dispatch({ type: "START_REQUESTED" });
    void ensureController().start({
      autoAdvanceFromWelcome:
        latestContextRef.current?.screenId === "welcome",
    });
  }, [ensureController, state.status]);

  const end = useCallback(() => controllerRef.current?.end(), []);

  const syncContext = useCallback((context: EnrollmentScreenContext) => {
    latestContextRef.current = context;
    controllerRef.current?.updateContext(context);
  }, []);

  const registerToolHandler = useCallback((handler: VoiceToolHandler | null) => {
    toolHandlerRef.current = handler;
  }, []);

  const registerInitialGreetingHandler = useCallback(
    (handler: InitialGreetingCompleteHandler | null) => {
      initialGreetingHandlerRef.current = handler;
    },
    [],
  );

  const value = useMemo(
    () => ({
      state,
      start,
      end,
      syncContext,
      registerToolHandler,
      registerInitialGreetingHandler,
    }),
    [
      end,
      registerInitialGreetingHandler,
      registerToolHandler,
      start,
      state,
      syncContext,
    ],
  );

  return <VoiceGuideContext.Provider value={value}>{children}</VoiceGuideContext.Provider>;
}

export function useVoiceGuide(): VoiceGuideContextValue {
  const context = useContext(VoiceGuideContext);
  if (!context) throw new Error("useVoiceGuide must be used within VoiceGuideProvider");
  return context;
}

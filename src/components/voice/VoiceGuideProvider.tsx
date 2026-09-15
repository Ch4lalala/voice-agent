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
};

const VoiceGuideContext = createContext<VoiceGuideContextValue | null>(null);

export function VoiceGuideProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(voiceStateReducer, initialVoiceState);
  const controllerRef = useRef<VoiceSessionController | null>(null);
  const latestContextRef = useRef<EnrollmentScreenContext | null>(null);

  useEffect(() => {
    const controller = new VoiceSessionController(createBrowserVoiceRuntime(), dispatch);
    controllerRef.current = controller;
    if (latestContextRef.current) controller.updateContext(latestContextRef.current);

    const endForPageExit = () => controller.dispose();
    window.addEventListener("pagehide", endForPageExit);

    return () => {
      window.removeEventListener("pagehide", endForPageExit);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (state.status !== "off" && state.status !== "error") return;
    dispatch({ type: "START_REQUESTED" });
    void controllerRef.current?.start();
  }, [state.status]);

  const end = useCallback(() => controllerRef.current?.end(), []);

  const syncContext = useCallback((context: EnrollmentScreenContext) => {
    latestContextRef.current = context;
    controllerRef.current?.updateContext(context);
  }, []);

  const value = useMemo(
    () => ({ state, start, end, syncContext }),
    [end, start, state, syncContext],
  );

  return <VoiceGuideContext.Provider value={value}>{children}</VoiceGuideContext.Provider>;
}

export function useVoiceGuide(): VoiceGuideContextValue {
  const context = useContext(VoiceGuideContext);
  if (!context) throw new Error("useVoiceGuide must be used within VoiceGuideProvider");
  return context;
}

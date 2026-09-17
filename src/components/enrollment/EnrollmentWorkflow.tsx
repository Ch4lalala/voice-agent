"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { createEnrollmentScreenContext } from "@/lib/enrollment-context";
import { createInitialEnrollmentState, enrollmentReducer } from "@/lib/enrollment-machine";
import { applyVoiceFieldHighlight } from "@/lib/voice-highlight";
import { executeVoiceTool, type VoiceToolCall } from "@/lib/voice-tools";
import {
  useVoiceGuide,
  VoiceGuideProvider,
} from "@/components/voice/VoiceGuideProvider";
import type {
  EditableFieldId,
  EnrollmentFieldId,
  EnrollmentScreenId,
  FacilityId,
  RequirementId,
  SpeechPreference,
} from "@/types/enrollment";

import { FacilitySelectionScreen } from "./screens/FacilitySelectionScreen";
import { FamilyInformationScreen } from "./screens/FamilyInformationScreen";
import { ParticipantInformationScreen } from "./screens/ParticipantInformationScreen";
import { RequirementsScreen } from "./screens/RequirementsScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";

const screenTitles: Record<EnrollmentScreenId, string> = {
  welcome: "Welcome",
  requirements: "Requirements",
  "family-information": "Family Information",
  "participant-information": "Participant Information",
  "facility-selection": "Healthcare Facility Selection",
  review: "Review",
};

function EnrollmentWorkflowContent() {
  const [state, dispatch] = useReducer(enrollmentReducer, undefined, createInitialEnrollmentState);
  const [resetRequested, setResetRequested] = useState(false);
  const [speechPreference, setSpeechPreference] = useState<SpeechPreference>("normal");
  const [highlightRequest, setHighlightRequest] = useState<{
    fieldId: EnrollmentFieldId;
    sequence: number;
  } | null>(null);
  const previousScreen = useRef(state.screenId);
  const stateRef = useRef(state);
  const speechPreferenceRef = useRef(speechPreference);
  const screenContext = createEnrollmentScreenContext(state, speechPreference);
  const {
    registerInitialGreetingHandler,
    registerToolHandler,
    syncContext,
  } = useVoiceGuide();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    speechPreferenceRef.current = speechPreference;
  }, [speechPreference]);

  const dispatchEnrollment = useCallback((event: Parameters<typeof enrollmentReducer>[1]) => {
    stateRef.current = enrollmentReducer(stateRef.current, event);
    dispatch(event);
  }, []);

  const handleVoiceTool = useCallback(
    (call: VoiceToolCall) => {
      const currentState = stateRef.current;
      const currentPreference = speechPreferenceRef.current;
      const currentContext = createEnrollmentScreenContext(
        currentState,
        currentPreference,
      );
      const execution = executeVoiceTool(call, currentState, currentContext);
      const nextState = execution.nextState ?? currentState;
      const nextPreference = execution.speechPreference ?? currentPreference;
      const hasApplicationEffect =
        Boolean(execution.event && execution.nextState) ||
        Boolean(execution.speechPreference) ||
        Boolean(execution.highlightFieldId) ||
        nextState !== currentState ||
        nextPreference !== currentPreference;

      if (!hasApplicationEffect) return execution;

      return {
        ...execution,
        apply: () => {
          if (execution.event && execution.nextState) {
            dispatchEnrollment(execution.event);
          }
          if (execution.speechPreference) {
            speechPreferenceRef.current = execution.speechPreference;
            setSpeechPreference(execution.speechPreference);
          }
          if (execution.highlightFieldId) {
            setHighlightRequest((request) => ({
              fieldId: execution.highlightFieldId!,
              sequence: (request?.sequence ?? 0) + 1,
            }));
          }

          if (nextState !== currentState || nextPreference !== currentPreference) {
            syncContext(createEnrollmentScreenContext(nextState, nextPreference));
          }
        },
      };
    },
    [dispatchEnrollment, syncContext],
  );

  useEffect(() => {
    registerToolHandler(handleVoiceTool);
    return () => registerToolHandler(null);
  }, [handleVoiceTool, registerToolHandler]);

  const handleInitialGreetingComplete = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.screenId !== "welcome") return false;

    const event = { type: "START_MANUAL" } as const;
    const nextState = enrollmentReducer(currentState, event);
    if (nextState.screenId !== "requirements") return false;

    dispatchEnrollment(event);
    syncContext(
      createEnrollmentScreenContext(nextState, speechPreferenceRef.current),
    );
    return true;
  }, [dispatchEnrollment, syncContext]);

  useEffect(() => {
    registerInitialGreetingHandler(handleInitialGreetingComplete);
    return () => registerInitialGreetingHandler(null);
  }, [handleInitialGreetingComplete, registerInitialGreetingHandler]);

  useEffect(() => {
    syncContext(screenContext);
  }, [screenContext, syncContext]);

  useEffect(() => {
    document.title = `${screenTitles[state.screenId]} — AksesSuara`;
  }, [state.screenId]);

  useEffect(() => {
    if (previousScreen.current !== state.screenId) {
      document.getElementById(`${state.screenId}-title`)?.focus();
      previousScreen.current = state.screenId;
    }
  }, [state.screenId]);

  useEffect(() => {
    const request = state.focusRequest;
    if (!request) return;

    const field =
      request.fieldId === "facilityId"
        ? document.querySelector<HTMLInputElement>('input[name="facility"]')
        : document.getElementById(request.fieldId);
    field?.focus();
  }, [state.focusRequest]);

  useEffect(() => {
    const request = highlightRequest;
    if (!request) return;

    const removeHighlight = applyVoiceFieldHighlight(
      document,
      request.fieldId,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    if (!removeHighlight) return;

    const timeout = window.setTimeout(() => {
      removeHighlight();
    }, 5_000);
    return () => {
      window.clearTimeout(timeout);
      removeHighlight();
    };
  }, [highlightRequest, state.screenId]);

  useEffect(() => {
    if (state.demoCompleted) document.getElementById("completion-title")?.focus();
  }, [state.demoCompleted]);

  useEffect(() => {
    if (resetRequested) document.getElementById("cancel-reset-button")?.focus();
  }, [resetRequested]);

  function updateField(fieldId: EditableFieldId, value: string) {
    dispatchEnrollment({ type: "UPDATE_FIELD", fieldId, value });
  }

  function cancelReset() {
    setResetRequested(false);
    requestAnimationFrame(() => document.getElementById("reset-demo-button")?.focus());
  }

  function resetDemo() {
    dispatchEnrollment({ type: "RESET" });
    setSpeechPreference("normal");
    setHighlightRequest(null);
    setResetRequested(false);
  }

  function renderScreen() {
    switch (state.screenId) {
      case "requirements":
        return (
          <RequirementsScreen
            data={state.data}
            errors={state.errors}
            returningToReview={state.returningToReview}
            onToggle={(requirementId: RequirementId) => dispatchEnrollment({ type: "TOGGLE_REQUIREMENT", requirementId })}
            onPrevious={() => dispatchEnrollment({ type: "PREVIOUS" })}
            onNext={() => dispatchEnrollment({ type: "NEXT" })}
          />
        );
      case "family-information":
        return (
          <FamilyInformationScreen
            data={state.data}
            errors={state.errors}
            returningToReview={state.returningToReview}
            onChange={updateField}
            onPrevious={() => dispatchEnrollment({ type: "PREVIOUS" })}
            onNext={() => dispatchEnrollment({ type: "NEXT" })}
          />
        );
      case "participant-information":
        return (
          <ParticipantInformationScreen
            data={state.data}
            errors={state.errors}
            returningToReview={state.returningToReview}
            onChange={updateField}
            onPrevious={() => dispatchEnrollment({ type: "PREVIOUS" })}
            onNext={() => dispatchEnrollment({ type: "NEXT" })}
          />
        );
      case "facility-selection":
        return (
          <FacilitySelectionScreen
            data={state.data}
            errors={state.errors}
            pendingFacilityId={state.pendingFacilityId}
            returningToReview={state.returningToReview}
            onRequestConfirmation={(facilityId: FacilityId) => dispatchEnrollment({ type: "REQUEST_FACILITY_CONFIRMATION", facilityId })}
            onCancelConfirmation={() => dispatchEnrollment({ type: "CANCEL_FACILITY_CONFIRMATION" })}
            onConfirm={() => dispatchEnrollment({ type: "CONFIRM_FACILITY" })}
            onPrevious={() => dispatchEnrollment({ type: "PREVIOUS" })}
            onNext={() => dispatchEnrollment({ type: "NEXT" })}
          />
        );
      case "review":
        return (
          <ReviewScreen
            data={state.data}
            demoCompleted={state.demoCompleted}
            onPrevious={() => dispatchEnrollment({ type: "PREVIOUS" })}
            onEdit={(step) => dispatchEnrollment({ type: "EDIT_STEP", step })}
            onReviewInformation={() => document.getElementById("review-summary-heading")?.focus()}
            onComplete={() => dispatchEnrollment({ type: "COMPLETE_DEMO" })}
            onResetRequest={() => setResetRequested(true)}
          />
        );
      case "welcome":
      default:
        return <WelcomeScreen onContinue={() => dispatchEnrollment({ type: "START_MANUAL" })} />;
    }
  }

  return (
    <div
      className="app-shell"
      data-context-screen={screenContext.screenId}
      data-context-can-proceed={screenContext.canProceed}
    >
      <a className="skip-link" href="#screen-content">Skip to enrollment step</a>

      <header className="app-header">
        <div className="app-header__bar">
          <div className="brand" aria-label="AksesSuara">
            <span className="brand__mark" aria-hidden="true"><span /><span /><span /></span>
            <span className="brand__copy"><strong>AksesSuara</strong><small>Guided access, one step at a time</small></span>
          </div>

          <div className="header-actions">
            <div className="header-badges" aria-label="Prototype status">
              <span className="status-badge">In-memory workflow</span>
              <span className="demo-badge">Demo data only</span>
            </div>
            {state.screenId !== "welcome" ? (
              <button id="reset-demo-button" className="button button--quiet button--compact" type="button" onClick={() => setResetRequested(true)}>Reset Demo</button>
            ) : null}
          </div>
        </div>

        {resetRequested ? (
          <section className="reset-confirmation" aria-labelledby="reset-confirmation-title">
            <div><strong id="reset-confirmation-title">Reset this demo?</strong><p>All information in this tab will be cleared and you will return to Welcome.</p></div>
            <div>
              <button id="cancel-reset-button" className="button button--quiet" type="button" onClick={cancelReset}>Keep my information</button>
              <button className="button button--warning" type="button" onClick={resetDemo}>Reset Demo</button>
            </div>
          </section>
        ) : null}
      </header>

      <main id="screen-content" className="app-main" tabIndex={-1}>{renderScreen()}</main>

      <footer className="app-footer">
        <p>Independent hackathon concept · AssemblyAI powers optional voice only</p>
        <p>Enrollment remains an in-memory demo</p>
      </footer>
    </div>
  );
}

export function EnrollmentWorkflow() {
  return (
    <VoiceGuideProvider>
      <EnrollmentWorkflowContent />
    </VoiceGuideProvider>
  );
}

import { serializeEnrollmentScreenContext } from "@/lib/enrollment-context";
import { enrollmentReducer } from "@/lib/enrollment-machine";
import {
  allRequiredStepsComplete,
  isStepComplete,
} from "@/lib/validation";
import {
  enrollmentSteps,
  voiceToolNames,
  type EnrollmentEvent,
  type EnrollmentFieldId,
  type EnrollmentScreenContext,
  type EnrollmentState,
  type EnrollmentStep,
  type SpeechPreference,
  type VoiceToolName,
} from "@/types/enrollment";

export interface VoiceToolCall {
  callId: string;
  name: string;
  arguments: unknown;
  expectedContextKey: string | null;
}

export type VoiceToolResult = Record<string, unknown> & {
  status: "success" | "blocked";
  is_error: boolean;
  code?: string;
  message?: string;
};

export interface VoiceToolExecution {
  result: VoiceToolResult;
  feedback: string;
  apply?: () => void;
  event?: EnrollmentEvent;
  nextState?: EnrollmentState;
  highlightFieldId?: EnrollmentFieldId;
  speechPreference?: SpeechPreference;
}

const screenSummaries: Record<EnrollmentScreenContext["screenId"], string> = {
  welcome: "Choose whether to start optional voice guidance or continue manually.",
  requirements: "Confirm that the four demo requirements are ready.",
  "family-information":
    "Type a dummy Family Card number and choose the participant relationship.",
  "participant-information":
    "Enter a fictional full name, dummy date of birth, and dummy phone number.",
  "facility-selection":
    "Compare fictional facilities, choose one, and confirm the choice yourself.",
  review: "Review the completed demo information. Nothing has been submitted.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isVoiceToolName(name: string): name is VoiceToolName {
  return voiceToolNames.includes(name as VoiceToolName);
}

function blocked(
  code: string,
  message: string,
  isError = true,
): VoiceToolExecution {
  return {
    result: { status: "blocked", is_error: isError, code, message },
    feedback: message,
  };
}

function joinLabels(labels: string[]): string {
  if (labels.length === 1) return `“${labels[0]}”`;
  if (labels.length === 2) return `“${labels[0]}” and “${labels[1]}”`;
  return `${labels.slice(0, -1).map((label) => `“${label}”`).join(", ")}, and “${labels.at(-1)}”`;
}

function validateArguments(
  name: VoiceToolName,
  value: unknown,
): { valid: true; value: Record<string, unknown> } | { valid: false } {
  if (!isRecord(value)) return { valid: false };

  if (
    name === "explain_current_screen" ||
    name === "validate_current_step" ||
    name === "go_to_next_step" ||
    name === "go_to_previous_step" ||
    name === "show_review"
  ) {
    return hasExactKeys(value, []) ? { valid: true, value } : { valid: false };
  }

  if (name === "highlight_field") {
    return hasExactKeys(value, ["fieldId"]) && typeof value.fieldId === "string"
      ? { valid: true, value }
      : { valid: false };
  }

  if (name === "repeat_instruction") {
    return hasExactKeys(value, ["mode"]) &&
      (value.mode === "same" || value.mode === "simpler")
      ? { valid: true, value }
      : { valid: false };
  }

  return hasExactKeys(value, ["pace"]) &&
    (value.pace === "normal" || value.pace === "slow")
    ? { valid: true, value }
    : { valid: false };
}

function validationResult(
  state: EnrollmentState,
  context: EnrollmentScreenContext,
): VoiceToolExecution {
  const event: EnrollmentEvent = { type: "VALIDATE_CURRENT_STEP" };
  const nextState = enrollmentReducer(state, event);
  const missingFields = context.fields
    .filter((field) => field.required && !field.complete)
    .map((field) => field.id);
  const missingFieldLabels = missingFields.map(
    (fieldId) =>
      context.fields.find((field) => field.id === fieldId)?.label ??
      "Required field",
  );

  if (missingFields.length) {
    const instruction = `Please complete ${joinLabels(missingFieldLabels)}.`;
    return {
      event,
      nextState,
      feedback: instruction,
      result: {
        status: "blocked",
        is_error: false,
        code: "validation_failed",
        completionState: "incomplete",
        canProceed: false,
        missingFields,
        missingFieldLabels,
        errors: context.fields
          .filter((field) => field.error || missingFields.includes(field.id))
          .map((field) => ({
            fieldId: field.id,
            message: field.error ?? `Complete ${field.label}.`,
          })),
        message: instruction,
      },
    };
  }

  return {
    event,
    nextState,
    result: {
      status: "success",
      is_error: false,
      completionState: "complete",
      canProceed: true,
      message: "This step is complete.",
    },
    feedback: "This step is ready to continue.",
  };
}

function incompleteSections(state: EnrollmentState): EnrollmentStep[] {
  return enrollmentSteps.filter(
    (step) => step !== "review" && !isStepComplete(step, state.data),
  );
}

export function executeVoiceTool(
  call: VoiceToolCall,
  state: EnrollmentState,
  context: EnrollmentScreenContext,
): VoiceToolExecution {
  if (!isVoiceToolName(call.name)) {
    return blocked("unknown_tool", "That voice action is not available in this demo.");
  }

  const parsedArguments = validateArguments(call.name, call.arguments);
  if (!parsedArguments.valid) {
    return blocked("invalid_arguments", "That voice action used invalid information and was not applied.");
  }

  if (
    call.expectedContextKey === null ||
    call.expectedContextKey !== serializeEnrollmentScreenContext(context) ||
    context.screenId !== state.screenId
  ) {
    return blocked("stale_context", "The screen changed before that voice action could run. Please try again.");
  }

  if (call.name === "show_review" && !allRequiredStepsComplete(state.data)) {
    const sections = incompleteSections(state);
    return {
      result: {
        status: "blocked",
        is_error: false,
        code: "enrollment_incomplete",
        incompleteSections: sections,
        message: "Complete the listed demo sections before opening Review.",
      },
      feedback: "Review is not available until every required demo section is complete.",
    };
  }

  if (!context.allowedActions.includes(call.name)) {
    return blocked("action_unavailable", "That voice action is not available on this screen.");
  }

  switch (call.name) {
    case "explain_current_screen": {
      const nextRequiredField = context.fields.find(
        (field) => field.required && !field.complete,
      )?.id ?? null;
      return {
        result: {
          status: "success",
          is_error: false,
          screenId: context.screenId,
          title: context.title,
          summary: screenSummaries[context.screenId],
          nextRequiredField,
        },
        feedback: `Voice Guide explained ${context.title}.`,
      };
    }
    case "highlight_field": {
      const fieldId = parsedArguments.value.fieldId as string;
      const field = context.fields.find((candidate) => candidate.id === fieldId);
      if (!field) {
        return blocked("unknown_field", "That field is not present on this screen.");
      }
      return {
        result: {
          status: "success",
          is_error: false,
          fieldId: field.id,
          label: field.label,
          message: "The field is focused and highlighted. Its value was not changed.",
        },
        feedback: `${field.label} is focused and highlighted.`,
        highlightFieldId: field.id,
      };
    }
    case "validate_current_step":
      return validationResult(state, context);
    case "go_to_next_step": {
      if (state.screenId === "welcome") {
        const event: EnrollmentEvent = { type: "START_MANUAL" };
        return {
          event,
          nextState: enrollmentReducer(state, event),
          result: {
            status: "success",
            is_error: false,
            previousScreenId: "welcome",
            screenId: "requirements",
          },
          feedback: "Moved to Requirements.",
        };
      }
      if (state.screenId === "review") {
        return blocked(
          "navigation_blocked",
          "Review is the final demo screen. Nothing was submitted.",
          false,
        );
      }

      const validation = validationResult(state, context);
      if (validation.result.status === "blocked") return validation;

      const event: EnrollmentEvent = { type: "NEXT" };
      const nextState = enrollmentReducer(state, event);
      if (nextState.screenId === state.screenId) {
        return blocked(
          "navigation_blocked",
          "This step cannot continue yet.",
          false,
        );
      }
      return {
        event,
        nextState,
        result: {
          status: "success",
          is_error: false,
          previousScreenId: state.screenId,
          screenId: nextState.screenId,
        },
        feedback: `Moved to ${nextState.screenId === "review" ? "Review" : nextState.screenId.replaceAll("-", " ")}.`,
      };
    }
    case "go_to_previous_step": {
      const event: EnrollmentEvent = { type: "PREVIOUS" };
      const nextState = enrollmentReducer(state, event);
      if (nextState.screenId === state.screenId) {
        return blocked(
          "navigation_blocked",
          "There is no previous screen available here.",
          false,
        );
      }
      return {
        event,
        nextState,
        result: {
          status: "success",
          is_error: false,
          previousScreenId: state.screenId,
          screenId: nextState.screenId,
        },
        feedback: `Moved back to ${nextState.screenId.replaceAll("-", " ")}.`,
      };
    }
    case "repeat_instruction": {
      const mode = parsedArguments.value.mode as "same" | "simpler";
      return {
        result: {
          status: "success",
          is_error: false,
          mode,
          screenId: context.screenId,
          message:
            mode === "simpler"
              ? "Restate only the current instruction using simpler words."
              : "Repeat only the current instruction.",
        },
        feedback:
          mode === "simpler"
            ? "The next instruction will use simpler words."
            : "The current instruction will be repeated.",
      };
    }
    case "set_speech_preference": {
      const pace = parsedArguments.value.pace as SpeechPreference;
      return {
        result: {
          status: "success",
          is_error: false,
          pace,
          audioSpeedChanged: false,
          message:
            pace === "slow"
              ? "Use shorter, more deliberate sentences. Audio playback speed is unchanged."
              : "Use the normal concise speaking style. Audio playback speed is unchanged.",
        },
        feedback:
          pace === "slow"
            ? "Voice Guide will use shorter, more deliberate sentences."
            : "Voice Guide will use its normal concise style.",
        speechPreference: pace,
      };
    }
    case "show_review": {
      const event: EnrollmentEvent = { type: "SHOW_REVIEW" };
      const nextState = enrollmentReducer(state, event);
      return {
        event,
        nextState,
        result: {
          status: "success",
          is_error: false,
          screenId: "review",
          submitted: false,
          message: "Review opened. Nothing was confirmed or submitted.",
        },
        feedback: "Review opened. Nothing was submitted.",
      };
    }
  }
}

export const voiceToolDefinitions = [
  {
    type: "function",
    name: "explain_current_screen",
    description: "Explain the current trusted application screen and the next incomplete field. Never guess from conversation history.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "highlight_field",
    description: "Focus and visibly highlight one field from the current screen context without changing its value.",
    parameters: {
      type: "object",
      properties: {
        fieldId: {
          type: "string",
          description: "Exact stable field identifier from the current screen context.",
        },
      },
      required: ["fieldId"],
      additionalProperties: false,
    },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "validate_current_step",
    description: "Run deterministic application validation on the current step. This never navigates.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "go_to_next_step",
    description: "Validate and move exactly one step when allowed. Never use for consent, confirmation, or submission.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "go_to_previous_step",
    description: "Move to the immediately previous screen through the application state machine.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "repeat_instruction",
    description: "Repeat only the current instruction, either unchanged or with simpler wording.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["same", "simpler"] },
      },
      required: ["mode"],
      additionalProperties: false,
    },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "set_speech_preference",
    description: "Set normal or slow behavioral guidance. Slow means shorter, more deliberate sentences; it does not change audio speed.",
    parameters: {
      type: "object",
      properties: {
        pace: { type: "string", enum: ["normal", "slow"] },
      },
      required: ["pace"],
      additionalProperties: false,
    },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
  {
    type: "function",
    name: "show_review",
    description: "Open Review only when every required demo section is complete. Never confirm or submit anything.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execution_mode: "interactive",
    timeout_seconds: 10,
  },
] as const;

import {
  allRequiredStepsComplete,
  getFieldError,
  stepFieldIds,
  validateStep,
} from "@/lib/validation";
import { digitsOnly } from "@/lib/masking";
import {
  requirementIds,
  type EditableFieldId,
  type EnrollmentEvent,
  type EnrollmentFieldId,
  type EnrollmentScreenId,
  type EnrollmentState,
  type EnrollmentStep,
  type ValidationErrors,
} from "@/types/enrollment";

const nextStep: Record<Exclude<EnrollmentStep, "review">, EnrollmentStep> = {
  requirements: "family-information",
  "family-information": "participant-information",
  "participant-information": "facility-selection",
  "facility-selection": "review",
};

const previousStep: Record<EnrollmentStep, EnrollmentScreenId> = {
  requirements: "welcome",
  "family-information": "requirements",
  "participant-information": "family-information",
  "facility-selection": "participant-information",
  review: "facility-selection",
};

const editableFieldStep: Record<EditableFieldId, EnrollmentStep> = {
  familyCardNumber: "family-information",
  relationship: "family-information",
  fullName: "participant-information",
  dateOfBirth: "participant-information",
  phoneNumber: "participant-information",
};

export function createInitialEnrollmentState(): EnrollmentState {
  return {
    screenId: "welcome",
    data: {
      requirements: {
        identificationCardAvailable: false,
        familyCardAvailable: false,
        phoneNumberAvailable: false,
        emailAddressReady: false,
      },
      familyCardNumber: "",
      relationship: "",
      fullName: "",
      dateOfBirth: "",
      phoneNumber: "",
      facilityId: null,
    },
    errors: {},
    pendingFacilityId: null,
    returningToReview: false,
    demoCompleted: false,
    focusRequest: null,
  };
}

function withoutStepErrors(
  errors: ValidationErrors,
  step: EnrollmentStep,
): ValidationErrors {
  const nextErrors = { ...errors };
  for (const fieldId of stepFieldIds[step]) delete nextErrors[fieldId];
  return nextErrors;
}

function withUpdatedFieldError(
  errors: ValidationErrors,
  fieldId: EnrollmentFieldId,
  state: EnrollmentState,
): ValidationErrors {
  if (!(fieldId in errors)) return errors;

  const nextErrors = { ...errors };
  const nextError = getFieldError(fieldId, state.data);
  if (nextError) nextErrors[fieldId] = nextError;
  else delete nextErrors[fieldId];
  return nextErrors;
}

function updateEditableField(
  state: EnrollmentState,
  fieldId: EditableFieldId,
  value: string,
): EnrollmentState {
  let normalizedValue = value;
  if (fieldId === "familyCardNumber") normalizedValue = digitsOnly(value).slice(0, 16);
  if (fieldId === "phoneNumber") normalizedValue = digitsOnly(value).slice(0, 13);
  if (
    fieldId === "relationship" &&
    !["", "self", "spouse", "child", "parent"].includes(value)
  ) {
    normalizedValue = "";
  }

  const data = { ...state.data, [fieldId]: normalizedValue };
  const nextState = { ...state, data, demoCompleted: false };
  return {
    ...nextState,
    errors: withUpdatedFieldError(state.errors, fieldId, nextState),
  };
}

function advance(state: EnrollmentState): EnrollmentState {
  if (state.screenId === "welcome" || state.screenId === "review") return state;

  const step = state.screenId;
  const errors = validateStep(step, state.data);
  const firstInvalidField = stepFieldIds[step].find((fieldId) => errors[fieldId]);

  if (firstInvalidField) {
    return {
      ...state,
      errors: { ...withoutStepErrors(state.errors, step), ...errors },
      focusRequest: {
        fieldId: firstInvalidField,
        sequence: (state.focusRequest?.sequence ?? 0) + 1,
      },
    };
  }

  const destination = state.returningToReview ? "review" : nextStep[step];
  return {
    ...state,
    screenId: destination,
    errors: withoutStepErrors(state.errors, step),
    pendingFacilityId: null,
    returningToReview: false,
    demoCompleted: false,
    focusRequest: null,
  };
}

function validateCurrentStep(state: EnrollmentState): EnrollmentState {
  if (state.screenId === "welcome" || state.screenId === "review") return state;

  const step = state.screenId;
  const errors = validateStep(step, state.data);
  const firstInvalidField = stepFieldIds[step].find((fieldId) => errors[fieldId]);
  return {
    ...state,
    errors: { ...withoutStepErrors(state.errors, step), ...errors },
    focusRequest: firstInvalidField
      ? {
          fieldId: firstInvalidField,
          sequence: (state.focusRequest?.sequence ?? 0) + 1,
        }
      : null,
  };
}

export function enrollmentReducer(
  state: EnrollmentState,
  event: EnrollmentEvent,
): EnrollmentState {
  switch (event.type) {
    case "START_MANUAL":
      return state.screenId === "welcome"
        ? { ...state, screenId: "requirements", focusRequest: null }
        : state;
    case "TOGGLE_REQUIREMENT": {
      if (state.screenId !== "requirements") return state;
      const data = {
        ...state.data,
        requirements: {
          ...state.data.requirements,
          [event.requirementId]: !state.data.requirements[event.requirementId],
        },
      };
      const nextState = { ...state, data, demoCompleted: false };
      return {
        ...nextState,
        errors: withUpdatedFieldError(state.errors, event.requirementId, nextState),
      };
    }
    case "UPDATE_FIELD":
      return state.screenId === editableFieldStep[event.fieldId]
        ? updateEditableField(state, event.fieldId, event.value)
        : state;
    case "REQUEST_FACILITY_CONFIRMATION":
      return state.screenId === "facility-selection"
        ? { ...state, pendingFacilityId: event.facilityId, demoCompleted: false }
        : state;
    case "CANCEL_FACILITY_CONFIRMATION":
      return state.screenId === "facility-selection"
        ? { ...state, pendingFacilityId: null }
        : state;
    case "CONFIRM_FACILITY": {
      if (state.screenId !== "facility-selection" || !state.pendingFacilityId) return state;
      const data = { ...state.data, facilityId: state.pendingFacilityId };
      const errors = { ...state.errors };
      delete errors.facilityId;
      return {
        ...state,
        data,
        errors,
        pendingFacilityId: null,
        demoCompleted: false,
      };
    }
    case "VALIDATE_CURRENT_STEP":
      return validateCurrentStep(state);
    case "NEXT":
      return advance(state);
    case "PREVIOUS":
      return state.screenId === "welcome"
        ? state
        : {
            ...state,
            screenId: previousStep[state.screenId],
            pendingFacilityId: null,
            returningToReview: false,
            demoCompleted: false,
            focusRequest: null,
          };
    case "SHOW_REVIEW":
      return state.screenId !== "welcome" && allRequiredStepsComplete(state.data)
        ? {
            ...state,
            screenId: "review",
            pendingFacilityId: null,
            returningToReview: false,
            demoCompleted: false,
            focusRequest: null,
          }
        : state;
    case "EDIT_STEP":
      return state.screenId === "review" && allRequiredStepsComplete(state.data)
        ? {
            ...state,
            screenId: event.step,
            returningToReview: true,
            demoCompleted: false,
            focusRequest: null,
          }
        : state;
    case "COMPLETE_DEMO":
      return state.screenId === "review" && allRequiredStepsComplete(state.data)
        ? { ...state, demoCompleted: true }
        : state;
    case "RESET":
      return createInitialEnrollmentState();
    default:
      return state;
  }
}

export function applyEvents(
  initialState: EnrollmentState,
  events: EnrollmentEvent[],
): EnrollmentState {
  return events.reduce(enrollmentReducer, initialState);
}

export const requiredRequirementCount = requirementIds.length;

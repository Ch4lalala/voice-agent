import { getFieldError, isStepComplete } from "@/lib/validation";
import {
  type EnrollmentAllowedAction,
  type EnrollmentData,
  type EnrollmentFieldContext,
  type EnrollmentFieldId,
  type EnrollmentScreenId,
  type EnrollmentScreenContext,
  type EnrollmentState,
} from "@/types/enrollment";

const stepDetails: Record<
  EnrollmentScreenId,
  {
    title: string;
    step: number;
    fields: Array<{
      id: EnrollmentFieldId;
      label: string;
      description: string;
      required: boolean;
      sensitive: boolean;
    }>;
  }
> = {
  welcome: {
    title: "Welcome",
    step: 0,
    fields: [],
  },
  requirements: {
    title: "Requirements",
    step: 1,
    fields: [
      {
        id: "identificationCardAvailable",
        label: "Identification card available",
        description: "Confirm that a dummy identification card is available for this simulation.",
        required: true,
        sensitive: false,
      },
      {
        id: "familyCardAvailable",
        label: "Family Card available",
        description: "Confirm that a Family Card is available; any number must be typed, not spoken.",
        required: true,
        sensitive: false,
      },
      {
        id: "phoneNumberAvailable",
        label: "Active phone number available",
        description: "Confirm that a dummy active phone number is available for the simulated form.",
        required: true,
        sensitive: false,
      },
      {
        id: "emailAddressReady",
        label: "Email address available or not applicable",
        description: "Confirm that an email address is available or that email does not apply.",
        required: true,
        sensitive: false,
      },
    ],
  },
  "family-information": {
    title: "Family Information",
    step: 2,
    fields: [
      {
        id: "familyCardNumber",
        label: "Family Card Number",
        description: "Type a 16-digit dummy Family Card number into the visible field; never say it aloud.",
        required: true,
        sensitive: true,
      },
      {
        id: "relationship",
        label: "Relationship to participant",
        description: "Choose the participant relationship from the visible list.",
        required: true,
        sensitive: false,
      },
    ],
  },
  "participant-information": {
    title: "Participant Information",
    step: 3,
    fields: [
      {
        id: "fullName",
        label: "Full name",
        description: "Type a fictional full name for the demo.",
        required: true,
        sensitive: false,
      },
      {
        id: "dateOfBirth",
        label: "Date of birth",
        description: "Type a dummy date in YYYY-MM-DD format.",
        required: true,
        sensitive: true,
      },
      {
        id: "phoneNumber",
        label: "Phone number",
        description: "Type a dummy phone number into the visible field; never say it aloud.",
        required: true,
        sensitive: true,
      },
    ],
  },
  "facility-selection": {
    title: "Healthcare Facility Selection",
    step: 4,
    fields: [
      {
        id: "facilityId",
        label: "Confirmed healthcare facility",
        description: "Compare the fictional options, choose one, and confirm the choice using the visible controls.",
        required: true,
        sensitive: false,
      },
    ],
  },
  review: {
    title: "Review",
    step: 5,
    fields: [],
  },
};

function isFieldComplete(fieldId: EnrollmentFieldId, data: EnrollmentData): boolean {
  return getFieldError(fieldId, data) === null;
}

function allowedActionsFor(screenId: EnrollmentScreenId): EnrollmentAllowedAction[] {
  if (screenId === "welcome") {
    return ["start_voice_guidance", "continue_without_voice"];
  }
  if (screenId === "review") {
    return [
      "previous",
      "review_information",
      "edit_section",
      "confirm_demo_completion",
      "reset_demo",
    ];
  }

  return ["previous", "continue"];
}

export function createEnrollmentScreenContext(
  state: EnrollmentState,
): EnrollmentScreenContext {
  const screenId = state.screenId;
  const details = stepDetails[screenId];
  const fields: EnrollmentFieldContext[] = details.fields.map((field) => ({
    ...field,
    complete: isFieldComplete(field.id, state.data),
    error: state.errors[field.id] ? getFieldError(field.id, state.data) : null,
  }));

  return {
    screenId,
    title: details.title,
    step: details.step,
    totalSteps: 5,
    fields,
    allowedActions: allowedActionsFor(screenId),
    canProceed:
      screenId === "welcome" || screenId === "review"
        ? true
        : isStepComplete(screenId, state.data),
  };
}

export function serializeEnrollmentScreenContext(
  context: EnrollmentScreenContext,
): string {
  return JSON.stringify(context);
}

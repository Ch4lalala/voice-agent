import { getFieldError, isStepComplete } from "@/lib/validation";
import {
  type EnrollmentData,
  type EnrollmentFieldContext,
  type EnrollmentFieldId,
  type EnrollmentScreenContext,
  type EnrollmentState,
  type EnrollmentStep,
} from "@/types/enrollment";

const stepDetails: Record<
  EnrollmentStep,
  {
    title: string;
    step: number;
    fields: Array<{
      id: EnrollmentFieldId;
      label: string;
      required: boolean;
      sensitive: boolean;
    }>;
  }
> = {
  requirements: {
    title: "Requirements",
    step: 1,
    fields: [
      {
        id: "identificationCardAvailable",
        label: "Identification card available",
        required: true,
        sensitive: false,
      },
      {
        id: "familyCardAvailable",
        label: "Family Card available",
        required: true,
        sensitive: false,
      },
      {
        id: "phoneNumberAvailable",
        label: "Active phone number available",
        required: true,
        sensitive: false,
      },
      {
        id: "emailAddressReady",
        label: "Email address available or not applicable",
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
        required: true,
        sensitive: true,
      },
      {
        id: "relationship",
        label: "Relationship to participant",
        required: true,
        sensitive: false,
      },
    ],
  },
  "participant-information": {
    title: "Participant Information",
    step: 3,
    fields: [
      { id: "fullName", label: "Full name", required: true, sensitive: false },
      { id: "dateOfBirth", label: "Date of birth", required: true, sensitive: false },
      { id: "phoneNumber", label: "Phone number", required: true, sensitive: true },
    ],
  },
  "facility-selection": {
    title: "Healthcare Facility Selection",
    step: 4,
    fields: [
      {
        id: "facilityId",
        label: "Confirmed healthcare facility",
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

function allowedActionsFor(step: EnrollmentStep): string[] {
  if (step === "review") {
    return ["go_to_previous_step", "show_review"];
  }

  return ["validate_current_step", "go_to_previous_step", "go_to_next_step"];
}

export function createEnrollmentScreenContext(
  state: EnrollmentState,
): EnrollmentScreenContext | null {
  if (state.screenId === "welcome") return null;

  const step = state.screenId;
  const details = stepDetails[step];
  const fields: EnrollmentFieldContext[] = details.fields.map((field) => ({
    ...field,
    complete: isFieldComplete(field.id, state.data),
    error: state.errors[field.id] ?? null,
  }));

  return {
    screenId: step,
    title: details.title,
    step: details.step,
    totalSteps: 5,
    fields,
    allowedActions: allowedActionsFor(step),
    canProceed: step === "review" ? true : isStepComplete(step, state.data),
  };
}

import { digitsOnly } from "@/lib/masking";
import {
  requirementIds,
  type EditableFieldId,
  type EnrollmentData,
  type EnrollmentFieldId,
  type EnrollmentStep,
  type RequirementId,
  type ValidationErrors,
} from "@/types/enrollment";

const requirementMessages: Record<RequirementId, string> = {
  identificationCardAvailable: "Confirm that an identification card is available.",
  familyCardAvailable: "Confirm that a Family Card is available.",
  phoneNumberAvailable: "Confirm that an active dummy phone number is available.",
  emailAddressReady: "Confirm that an email address is available or does not apply.",
};

export const stepFieldIds: Record<EnrollmentStep, EnrollmentFieldId[]> = {
  requirements: [...requirementIds],
  "family-information": ["familyCardNumber", "relationship"],
  "participant-information": ["fullName", "dateOfBirth", "phoneNumber"],
  "facility-selection": ["facilityId"],
  review: [],
};

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    year >= 1900 &&
    year <= 2026 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getFieldError(
  fieldId: EnrollmentFieldId,
  data: EnrollmentData,
): string | null {
  if (requirementIds.includes(fieldId as RequirementId)) {
    const requirementId = fieldId as RequirementId;
    return data.requirements[requirementId] ? null : requirementMessages[requirementId];
  }

  switch (fieldId) {
    case "familyCardNumber":
      return digitsOnly(data.familyCardNumber).length === 16
        ? null
        : "Enter a 16-digit dummy Family Card number.";
    case "relationship":
      return data.relationship ? null : "Choose the participant’s relationship.";
    case "fullName":
      return data.fullName.trim().length >= 2 ? null : "Enter a fictional full name.";
    case "dateOfBirth":
      return isValidDateOnly(data.dateOfBirth)
        ? null
        : "Enter a valid dummy date in YYYY-MM-DD format, using a year from 1900 to 2026.";
    case "phoneNumber": {
      const digits = digitsOnly(data.phoneNumber);
      return /^0\d{9,12}$/.test(digits)
        ? null
        : "Enter a dummy phone number with 10 to 13 digits, starting with 0.";
    }
    case "facilityId":
      return data.facilityId ? null : "Choose and confirm a fictional healthcare facility.";
    default:
      return null;
  }
}

export function validateStep(step: EnrollmentStep, data: EnrollmentData): ValidationErrors {
  return stepFieldIds[step].reduce<ValidationErrors>((errors, fieldId) => {
    const error = getFieldError(fieldId, data);
    if (error) errors[fieldId] = error;
    return errors;
  }, {});
}

export function isStepComplete(step: EnrollmentStep, data: EnrollmentData): boolean {
  return Object.keys(validateStep(step, data)).length === 0;
}

export function allRequiredStepsComplete(data: EnrollmentData): boolean {
  return ([
    "requirements",
    "family-information",
    "participant-information",
    "facility-selection",
  ] as const).every((step) => isStepComplete(step, data));
}

export function isEditableFieldId(fieldId: EnrollmentFieldId): fieldId is EditableFieldId {
  return [
    "familyCardNumber",
    "relationship",
    "fullName",
    "dateOfBirth",
    "phoneNumber",
  ].includes(fieldId);
}

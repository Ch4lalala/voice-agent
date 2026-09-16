export const enrollmentSteps = [
  "requirements",
  "family-information",
  "participant-information",
  "facility-selection",
  "review",
] as const;

export type EnrollmentStep = (typeof enrollmentSteps)[number];
export type EnrollmentScreenId = "welcome" | EnrollmentStep;

export const requirementIds = [
  "identificationCardAvailable",
  "familyCardAvailable",
  "phoneNumberAvailable",
  "emailAddressReady",
] as const;

export type RequirementId = (typeof requirementIds)[number];

export type Relationship = "self" | "spouse" | "child" | "parent";

export type FacilityId = "taman-sari" | "harapan-family" | "cendana";

export type EnrollmentFieldId =
  | RequirementId
  | "familyCardNumber"
  | "relationship"
  | "fullName"
  | "dateOfBirth"
  | "phoneNumber"
  | "facilityId";

export type EditableFieldId =
  | "familyCardNumber"
  | "relationship"
  | "fullName"
  | "dateOfBirth"
  | "phoneNumber";

export type ValidationErrors = Partial<Record<EnrollmentFieldId, string>>;

export interface EnrollmentData {
  requirements: Record<RequirementId, boolean>;
  familyCardNumber: string;
  relationship: Relationship | "";
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  facilityId: FacilityId | null;
}

export interface FocusRequest {
  fieldId: EnrollmentFieldId;
  sequence: number;
}

export interface EnrollmentState {
  screenId: EnrollmentScreenId;
  data: EnrollmentData;
  errors: ValidationErrors;
  pendingFacilityId: FacilityId | null;
  returningToReview: boolean;
  demoCompleted: boolean;
  focusRequest: FocusRequest | null;
}

export interface EnrollmentFieldContext {
  id: EnrollmentFieldId;
  label: string;
  description: string;
  required: boolean;
  sensitive: boolean;
  complete: boolean;
  error: string | null;
}

export const voiceToolNames = [
  "explain_current_screen",
  "highlight_field",
  "validate_current_step",
  "go_to_next_step",
  "go_to_previous_step",
  "repeat_instruction",
  "set_speech_preference",
  "show_review",
] as const;

export type VoiceToolName = (typeof voiceToolNames)[number];
export type SpeechPreference = "normal" | "slow";
export type EnrollmentAllowedAction = VoiceToolName;

export interface EnrollmentScreenContext {
  screenId: EnrollmentScreenId;
  title: string;
  step: number;
  totalSteps: number;
  fields: EnrollmentFieldContext[];
  allowedActions: EnrollmentAllowedAction[];
  canProceed: boolean;
  speechPreference: SpeechPreference;
}

export type EnrollmentEvent =
  | { type: "START_MANUAL" }
  | { type: "TOGGLE_REQUIREMENT"; requirementId: RequirementId }
  | { type: "UPDATE_FIELD"; fieldId: EditableFieldId; value: string }
  | { type: "REQUEST_FACILITY_CONFIRMATION"; facilityId: FacilityId }
  | { type: "CANCEL_FACILITY_CONFIRMATION" }
  | { type: "CONFIRM_FACILITY" }
  | { type: "VALIDATE_CURRENT_STEP" }
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "SHOW_REVIEW" }
  | { type: "EDIT_STEP"; step: Exclude<EnrollmentStep, "review"> }
  | { type: "COMPLETE_DEMO" }
  | { type: "RESET" };

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
  required: boolean;
  sensitive: boolean;
  complete: boolean;
  error: string | null;
}

export interface EnrollmentScreenContext {
  screenId: EnrollmentStep;
  title: string;
  step: number;
  totalSteps: number;
  fields: EnrollmentFieldContext[];
  allowedActions: string[];
  canProceed: boolean;
}

export type EnrollmentEvent =
  | { type: "START_MANUAL" }
  | { type: "TOGGLE_REQUIREMENT"; requirementId: RequirementId }
  | { type: "UPDATE_FIELD"; fieldId: EditableFieldId; value: string }
  | { type: "REQUEST_FACILITY_CONFIRMATION"; facilityId: FacilityId }
  | { type: "CANCEL_FACILITY_CONFIRMATION" }
  | { type: "CONFIRM_FACILITY" }
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "EDIT_STEP"; step: Exclude<EnrollmentStep, "review"> }
  | { type: "COMPLETE_DEMO" }
  | { type: "RESET" };

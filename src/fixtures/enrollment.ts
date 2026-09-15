import type { FacilityId, RequirementId, Relationship } from "@/types/enrollment";

export const requirementFixtures: ReadonlyArray<{
  id: RequirementId;
  title: string;
  detail: string;
}> = [
  {
    id: "identificationCardAvailable",
    title: "Identification card available",
    detail: "Keep a dummy identification card nearby for this simulated flow.",
  },
  {
    id: "familyCardAvailable",
    title: "Family Card available",
    detail: "You will type a fictional Family Card number on the next screen.",
  },
  {
    id: "phoneNumberAvailable",
    title: "Active phone number available",
    detail: "Use dummy data only. Never enter a real phone number in this prototype.",
  },
  {
    id: "emailAddressReady",
    title: "Email address available, if applicable",
    detail: "Check this when an email is available or when email does not apply.",
  },
];

export const relationshipOptions: ReadonlyArray<{
  value: Relationship;
  label: string;
}> = [
  { value: "self", label: "Self" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
];

export const facilityFixtures: ReadonlyArray<{
  id: FacilityId;
  name: string;
  distance: string;
  hours: string;
}> = [
  {
    id: "taman-sari",
    name: "Taman Sari Community Clinic",
    distance: "1.2 km away",
    hours: "Weekdays · 08:00–16:00",
  },
  {
    id: "harapan-family",
    name: "Harapan Family Health Centre",
    distance: "2.8 km away",
    hours: "Weekdays · 10:00–19:00",
  },
  {
    id: "cendana",
    name: "Cendana Community Clinic",
    distance: "4.1 km away",
    hours: "Monday–Saturday · 08:00–14:00",
  },
];

export function getFacility(facilityId: FacilityId | null) {
  return facilityFixtures.find((facility) => facility.id === facilityId) ?? null;
}

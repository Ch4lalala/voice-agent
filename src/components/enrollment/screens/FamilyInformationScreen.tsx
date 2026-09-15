import type { ChangeEvent, FormEvent } from "react";

import { relationshipOptions } from "@/fixtures/enrollment";
import type { EnrollmentData, Relationship, ValidationErrors } from "@/types/enrollment";

import { PreviewField } from "../PreviewField";
import { ScreenPreview } from "../ScreenPreview";
import { SensitiveInput } from "../SensitiveInput";

type FamilyInformationScreenProps = {
  data: EnrollmentData;
  errors: ValidationErrors;
  onChange: (fieldId: "familyCardNumber" | "relationship", value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  returningToReview: boolean;
};

export function FamilyInformationScreen({ data, errors, onChange, onNext, onPrevious, returningToReview }: FamilyInformationScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNext();
  }

  function handleRelationshipChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange("relationship", event.target.value as Relationship);
  }

  return (
    <ScreenPreview screenId="family-information" screenNumber={3} currentStep={2} title="Family information" description="Enter a fictional Family Card number and choose the participant relationship.">
      <div className="stage-heading">
        <div><p className="stage-kicker">Step 2 · Family information</p><h2>Start with the Family Card</h2></div>
        <span className="demo-badge">Demo data only</span>
      </div>

      <aside className="privacy-callout">
        <span className="privacy-callout__mark" aria-hidden="true">⌁</span>
        <div><strong>Keep this number private</strong><p>Type a dummy number below. It masks on blur and reveals only while you safely edit it.</p></div>
      </aside>

      <form className="preview-form" noValidate aria-label="Family information form" onSubmit={handleSubmit}>
        <PreviewField fieldId="familyCardNumber" label="Family Card Number" hint="Enter exactly 16 dummy digits. Focus the field again to reveal and edit your in-memory value." error={errors.familyCardNumber} required sensitive>
          <SensitiveInput
            fieldId="familyCardNumber"
            name="familyCardNumber"
            maxLength={16}
            type="text"
            inputMode="numeric"
            placeholder="3273000000003210"
            value={data.familyCardNumber}
            onChange={(value) => onChange("familyCardNumber", value)}
            error={errors.familyCardNumber}
          />
        </PreviewField>

        <PreviewField fieldId="relationship" label="Relationship to participant" hint="This demo accepts the platform’s native selection control." error={errors.relationship} required>
          <select
            id="relationship"
            name="relationship"
            value={data.relationship}
            onChange={handleRelationshipChange}
            aria-describedby={`relationship-hint${errors.relationship ? " relationship-error" : ""}`}
            aria-invalid={Boolean(errors.relationship)}
            required
          >
            <option value="" disabled>Choose a relationship</option>
            {relationshipOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </PreviewField>

        <div className="action-row action-row--between">
          <button className="button button--quiet" type="button" onClick={onPrevious}>Previous</button>
          <button className="button button--primary" type="submit">{returningToReview ? "Return to review" : "Continue"}</button>
        </div>
      </form>
    </ScreenPreview>
  );
}

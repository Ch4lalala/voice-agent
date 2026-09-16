import type { ChangeEvent, FormEvent } from "react";

import type { EnrollmentData, ValidationErrors } from "@/types/enrollment";

import { PreviewField } from "../PreviewField";
import { ScreenPreview } from "../ScreenPreview";
import { SensitiveInput } from "../SensitiveInput";

type ParticipantInformationScreenProps = {
  data: EnrollmentData;
  errors: ValidationErrors;
  onChange: (fieldId: "fullName" | "dateOfBirth" | "phoneNumber", value: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  returningToReview: boolean;
};

export function ParticipantInformationScreen({ data, errors, onChange, onNext, onPrevious, returningToReview }: ParticipantInformationScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNext();
  }

  function update(fieldId: "fullName" | "dateOfBirth") {
    return (event: ChangeEvent<HTMLInputElement>) => onChange(fieldId, event.target.value);
  }

  return (
    <ScreenPreview screenId="participant-information" screenNumber={4} currentStep={3} title="Participant information" description="Add fictional personal details for the person represented in this demonstration.">
      <div className="stage-heading">
        <div><p className="stage-kicker">Step 3 · Participant information</p><h2>Tell us about the participant</h2></div>
        <span className="demo-badge">Demo data only</span>
      </div>

      <form className="preview-form preview-form--two-column" noValidate aria-label="Participant information form" onSubmit={handleSubmit}>
        <PreviewField fieldId="fullName" label="Full name" hint="Enter a fictional name, such as Budi Santoso." error={errors.fullName} required>
          <input
            id="fullName"
            name="fullName"
            className="text-input text-input--highlighted"
            type="text"
            autoComplete="off"
            placeholder="Budi Santoso"
            value={data.fullName}
            onChange={update("fullName")}
            aria-describedby={`fullName-hint${errors.fullName ? " fullName-error" : ""}`}
            aria-invalid={Boolean(errors.fullName)}
            required
          />
        </PreviewField>

        <PreviewField fieldId="dateOfBirth" label="Date of birth" hint="Enter a valid dummy date in YYYY-MM-DD format." error={errors.dateOfBirth} required>
          <input
            id="dateOfBirth"
            name="dateOfBirth"
            className="text-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY-MM-DD"
            value={data.dateOfBirth}
            onChange={update("dateOfBirth")}
            aria-describedby={`dateOfBirth-hint${errors.dateOfBirth ? " dateOfBirth-error" : ""}`}
            aria-invalid={Boolean(errors.dateOfBirth)}
            required
          />
        </PreviewField>

        <div className="preview-form__full">
          <PreviewField fieldId="phoneNumber" label="Phone number" hint="Enter 10 to 13 dummy digits starting with 0. Focus again to reveal and edit." error={errors.phoneNumber} required sensitive>
            <SensitiveInput
              fieldId="phoneNumber"
              name="phoneNumber"
              maxLength={13}
              type="tel"
              inputMode="tel"
              placeholder="08xx xxxx xxxx"
              value={data.phoneNumber}
              onChange={(value) => onChange("phoneNumber", value)}
              error={errors.phoneNumber}
            />
          </PreviewField>
        </div>

        <div className="soft-note soft-note--split preview-form__full">
          <div><strong>Manual guidance is active.</strong><p>Every decision is made by deterministic application code.</p></div>
          <span>Values clear on refresh</span>
        </div>

        <div className="action-row action-row--between preview-form__full">
          <button className="button button--quiet" type="button" onClick={onPrevious}>Previous</button>
          <button className="button button--primary" type="submit">{returningToReview ? "Return to review" : "Continue"}</button>
        </div>
      </form>
    </ScreenPreview>
  );
}

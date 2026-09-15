import type { FormEvent } from "react";

import { requirementFixtures } from "@/fixtures/enrollment";
import type { EnrollmentData, RequirementId, ValidationErrors } from "@/types/enrollment";

import { ScreenPreview } from "../ScreenPreview";

type RequirementsScreenProps = {
  data: EnrollmentData;
  errors: ValidationErrors;
  onNext: () => void;
  onPrevious: () => void;
  onToggle: (requirementId: RequirementId) => void;
  returningToReview: boolean;
};

export function RequirementsScreen({ data, errors, onNext, onPrevious, onToggle, returningToReview }: RequirementsScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNext();
  }

  return (
    <ScreenPreview screenId="requirements" screenNumber={2} currentStep={1} title="Prepare your documents" description="Gather these items before entering any information. Nothing is uploaded in this demo.">
      <div className="stage-heading">
        <div><p className="stage-kicker">Step 1 · Requirements</p><h2>Let’s make sure you are ready</h2></div>
        <span className="demo-badge">Demo data only</span>
      </div>

      <form className="checklist" noValidate aria-label="Requirements checklist" onSubmit={handleSubmit}>
        {requirementFixtures.map((requirement, index) => {
          const checked = data.requirements[requirement.id];
          const error = errors[requirement.id];
          return (
            <label className="checklist__item" key={requirement.id}>
              <input
                id={requirement.id}
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(requirement.id)}
                aria-invalid={Boolean(error)}
                aria-describedby={`${requirement.id}-detail${error ? ` ${requirement.id}-error` : ""}`}
                required
              />
              <span className="checklist__box" aria-hidden="true">{checked ? "✓" : index + 1}</span>
              <span>
                <strong>{requirement.title}</strong>
                <small id={`${requirement.id}-detail`}>{requirement.detail}</small>
                {error ? <small id={`${requirement.id}-error`} className="field-error" role="alert">{error}</small> : null}
              </span>
            </label>
          );
        })}

        <div className="soft-note">
          <strong>Take your time.</strong>
          <p>Confirm each item yourself. Voice remains optional and cannot change this checklist.</p>
        </div>

        <div className="action-row action-row--between">
          <button className="button button--quiet" type="button" onClick={onPrevious}>Previous</button>
          <button className="button button--primary" type="submit">{returningToReview ? "Return to review" : "Continue"}</button>
        </div>
      </form>
    </ScreenPreview>
  );
}

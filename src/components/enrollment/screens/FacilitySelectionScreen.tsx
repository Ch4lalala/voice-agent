import { useEffect, type FormEvent } from "react";

import { facilityFixtures, getFacility } from "@/fixtures/enrollment";
import type { EnrollmentData, FacilityId, ValidationErrors } from "@/types/enrollment";

import { ScreenPreview } from "../ScreenPreview";

type FacilitySelectionScreenProps = {
  data: EnrollmentData;
  errors: ValidationErrors;
  onCancelConfirmation: () => void;
  onConfirm: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRequestConfirmation: (facilityId: FacilityId) => void;
  pendingFacilityId: FacilityId | null;
  returningToReview: boolean;
};

export function FacilitySelectionScreen({ data, errors, onCancelConfirmation, onConfirm, onNext, onPrevious, onRequestConfirmation, pendingFacilityId, returningToReview }: FacilitySelectionScreenProps) {
  const pendingFacility = getFacility(pendingFacilityId);

  useEffect(() => {
    if (pendingFacilityId) document.getElementById("confirm-facility-button")?.focus();
  }, [pendingFacilityId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onNext();
  }

  function cancelConfirmation() {
    const cancelledFacilityId = pendingFacilityId;
    onCancelConfirmation();
    requestAnimationFrame(() => document.getElementById(`facility-${cancelledFacilityId}`)?.focus());
  }

  return (
    <ScreenPreview screenId="facility-selection" screenNumber={5} currentStep={4} title="Choose a healthcare facility" description="Compare fictional options shown for demonstration. These are not real BPJS partner facilities.">
      <div className="stage-heading">
        <div><p className="stage-kicker">Step 4 · Facility selection</p><h2>Compare the options</h2></div>
        <span className="demo-badge">Fictional facilities</span>
      </div>

      <div className="decision-note">
        <strong>You make this choice.</strong>
        <p>Choose an option, then confirm it explicitly before the application records your selection.</p>
      </div>

      <form className="facility-form" noValidate aria-label="Fictional healthcare facility options" onSubmit={handleSubmit}>
        <fieldset
          className="facility-list"
          aria-describedby={errors.facilityId ? "facilityId-error" : undefined}
          aria-invalid={Boolean(errors.facilityId)}
        >
          <legend className="sr-only">Choose and confirm a fictional healthcare facility</legend>
          {facilityFixtures.map((facility) => {
            const isSelected = data.facilityId === facility.id;
            const isPending = pendingFacilityId === facility.id;
            return (
              <label className={`facility-card${isSelected ? " facility-card--selected" : ""}${isPending ? " facility-card--pending" : ""}`} key={facility.id}>
                <input
                  id={`facility-${facility.id}`}
                  type="radio"
                  name="facility"
                  value={facility.id}
                  checked={isSelected}
                  onChange={() => onRequestConfirmation(facility.id)}
                />
                <span className="facility-card__radio" aria-hidden="true" />
                <span className="facility-card__content">
                  <span className="facility-card__heading">
                    <strong>{facility.name}</strong>
                    {isSelected ? <small>Confirmed choice</small> : null}
                    {isPending ? <small>Confirmation needed</small> : null}
                  </span>
                  <span className="facility-card__meta"><span>{facility.distance}</span><span>{facility.hours}</span></span>
                  <small>Fictional option · General primary care</small>
                </span>
              </label>
            );
          })}
        </fieldset>

        {errors.facilityId ? <p id="facilityId-error" className="field-error field-error--standalone" role="alert"><span aria-hidden="true">!</span>{errors.facilityId}</p> : null}

        {pendingFacility ? (
          <section className="facility-confirmation" aria-labelledby="facility-confirmation-title" aria-live="polite">
            <div>
              <p className="stage-kicker">Explicit confirmation</p>
              <h3 id="facility-confirmation-title">Would you like to select this facility?</h3>
              <p>{pendingFacility.name} is fictional. Confirming only records it in this in-memory demo.</p>
            </div>
            <div className="facility-confirmation__actions">
              <button className="button button--quiet" type="button" onClick={cancelConfirmation}>Choose a different facility</button>
              <button id="confirm-facility-button" className="button button--primary" type="button" onClick={onConfirm}>Confirm this facility</button>
            </div>
          </section>
        ) : null}

        <div className="action-row action-row--between">
          <button className="button button--quiet" type="button" onClick={onPrevious}>Previous</button>
          <button className="button button--primary" type="submit">{returningToReview ? "Return to review" : "Continue"}</button>
        </div>
      </form>
    </ScreenPreview>
  );
}

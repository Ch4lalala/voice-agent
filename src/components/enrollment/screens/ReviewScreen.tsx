import { facilityFixtures, relationshipOptions } from "@/fixtures/enrollment";
import { maskSensitiveValue } from "@/lib/masking";
import type { EnrollmentData, EnrollmentStep } from "@/types/enrollment";

import { ScreenPreview } from "../ScreenPreview";

const disclaimer =
  "Independent hackathon prototype. This project is not affiliated with, endorsed by, or officially integrated with BPJS Kesehatan. It uses simulated screens and dummy data to demonstrate a proposed voice-assisted enrollment experience.";

type ReviewScreenProps = {
  data: EnrollmentData;
  demoCompleted: boolean;
  onComplete: () => void;
  onEdit: (step: Exclude<EnrollmentStep, "review">) => void;
  onPrevious: () => void;
  onResetRequest: () => void;
  onReviewInformation: () => void;
};

export function ReviewScreen({ data, demoCompleted, onComplete, onEdit, onPrevious, onResetRequest, onReviewInformation }: ReviewScreenProps) {
  const relationship = relationshipOptions.find((option) => option.value === data.relationship)?.label ?? "Not provided";
  const facility = facilityFixtures.find((option) => option.id === data.facilityId)?.name ?? "Not selected";
  const reviewSections: Array<{ title: string; step: Exclude<EnrollmentStep, "review">; rows: Array<[string, string]> }> = [
    { title: "Requirements", step: "requirements", rows: [["Readiness", "All four items confirmed"]] },
    { title: "Family information", step: "family-information", rows: [["Family Card Number", maskSensitiveValue(data.familyCardNumber, 4)], ["Relationship", relationship]] },
    { title: "Participant information", step: "participant-information", rows: [["Full name", data.fullName], ["Date of birth", data.dateOfBirth], ["Phone number", maskSensitiveValue(data.phoneNumber, 4)]] },
    { title: "Healthcare facility", step: "facility-selection", rows: [["Confirmed fictional facility", facility]] },
  ];

  return (
    <ScreenPreview screenId="review" screenNumber={6} currentStep={5} title="Review your information" description="Check the simulated details below. Sensitive values remain masked.">
      <div className="stage-heading" id="review-summary-heading" tabIndex={-1}>
        <div><p className="stage-kicker">Step 5 · Review</p><h2>One final check</h2></div>
        <span className="demo-badge">Demo data only</span>
      </div>

      <aside className="stop-notice">
        <span aria-hidden="true">■</span>
        <div><strong>No official registration has been submitted.</strong><p>This prototype stops before submission and cannot register anyone with BPJS Kesehatan.</p></div>
      </aside>

      {demoCompleted ? (
        <section className="completion-notice" aria-labelledby="completion-title" role="status">
          <span aria-hidden="true">✓</span>
          <div><h3 id="completion-title" tabIndex={-1}>Demo completion confirmed</h3><p>Your information has not been submitted anywhere. You can review it or reset this in-memory demo.</p></div>
        </section>
      ) : null}

      <div className="review-list">
        {reviewSections.map((section) => (
          <section className="review-section" key={section.title}>
            <header><h3>{section.title}</h3><button type="button" onClick={() => onEdit(section.step)}>Edit section</button></header>
            <dl>{section.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>
        ))}
      </div>

      <aside className="disclaimer" aria-label="Independent prototype disclaimer"><strong>Independent prototype</strong><p>{disclaimer}</p></aside>

      <div className="action-row action-row--between action-row--review">
        <button className="button button--quiet" type="button" onClick={onPrevious}>Previous</button>
        <button className="button button--secondary" type="button" onClick={onReviewInformation}>Review Information</button>
        {demoCompleted ? (
          <button className="button button--primary" type="button" onClick={onResetRequest}>Reset Demo</button>
        ) : (
          <button className="button button--primary" type="button" onClick={onComplete}>Confirm Demo Completion</button>
        )}
      </div>
    </ScreenPreview>
  );
}

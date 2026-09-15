const steps = [
  "Requirements",
  "Family information",
  "Participant information",
  "Facility selection",
  "Review",
] as const;

type EnrollmentProgressProps = {
  currentStep: number;
};

export function EnrollmentProgress({ currentStep }: EnrollmentProgressProps) {
  const currentLabel = currentStep > 0 ? steps[currentStep - 1] : null;

  return (
    <div className="progress" aria-label="Enrollment progress">
      <div className="progress__summary">
        <span>Enrollment journey</span>
        <strong>
          {currentLabel
            ? `Step ${currentStep} of ${steps.length} · ${currentLabel}`
            : "Five guided steps"}
        </strong>
      </div>
      <ol className="progress__track">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const state =
            currentStep === stepNumber
              ? "current"
              : currentStep > stepNumber
                ? "complete"
                : "upcoming";

          return (
            <li key={step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="progress__dot" aria-hidden="true">
                {state === "complete" ? "✓" : stepNumber}
              </span>
              <span className="progress__name">{step}</span>
              <span className="sr-only">{state === "complete" ? "Completed" : state}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

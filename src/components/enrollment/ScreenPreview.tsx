import type { ReactNode } from "react";

import { VoiceGuide } from "@/components/voice/VoiceGuide";
import type { EnrollmentScreenId } from "@/types/enrollment";

import { EnrollmentProgress } from "./EnrollmentProgress";

type ScreenPreviewProps = {
  children: ReactNode;
  currentStep: number;
  description: string;
  screenId: EnrollmentScreenId;
  screenNumber: number;
  title: string;
};

export function ScreenPreview({
  children,
  currentStep,
  description,
  screenId,
  screenNumber,
  title,
}: ScreenPreviewProps) {
  const titleId = `${screenId}-title`;

  return (
    <article className="screen-preview" aria-labelledby={titleId}>
      <header className="screen-preview__header">
        <div>
          <p className="eyebrow">Screen {screenNumber} of 6</p>
          <h1 id={titleId} tabIndex={-1}>{title}</h1>
          <p>{description}</p>
        </div>
        <span className="fixture-badge">In-memory demo</span>
      </header>

      <EnrollmentProgress currentStep={currentStep} />

      <div className="screen-preview__body">
        <section className="screen-stage" aria-label={`${title} screen content`}>
          {children}
        </section>
        <VoiceGuide screenId={screenId} />
      </div>

      <footer className="screen-preview__footer">
        <span aria-hidden="true">◇</span>
        <p>Information stays only in this tab and clears on refresh. Voice is optional and cannot change your entries.</p>
      </footer>
    </article>
  );
}

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PreviewField } from "../src/components/enrollment/PreviewField";
import { EnrollmentProgress } from "../src/components/enrollment/EnrollmentProgress";
import { ReviewScreen } from "../src/components/enrollment/screens/ReviewScreen";
import { SensitiveInput } from "../src/components/enrollment/SensitiveInput";
import { VoiceGuideView } from "../src/components/voice/VoiceGuide";
import { VoiceGuideProvider } from "../src/components/voice/VoiceGuideProvider";
import { initialVoiceState } from "../src/lib/voice-state";
import type { EnrollmentData } from "../src/types/enrollment";

describe("enrollment components", () => {
  it("renders a blurred sensitive input as a masked value", () => {
    const markup = renderToStaticMarkup(
      <SensitiveInput
        fieldId="familyCardNumber"
        inputMode="numeric"
        maxLength={16}
        name="familyCardNumber"
        onChange={() => undefined}
        placeholder="0000 0000 0000 0000"
        type="text"
        value="3273000000003210"
      />,
    );

    expect(markup).toContain("3210");
    expect(markup).toContain("••••");
    expect(markup).not.toContain("3273000000003210");
  });

  it("associates an adjacent accessible error with its field", () => {
    const markup = renderToStaticMarkup(
      <PreviewField
        fieldId="fullName"
        label="Full name"
        hint="Use fictional information."
        error="Enter a fictional full name."
      >
        <input id="fullName" aria-describedby="fullName-hint fullName-error" />
      </PreviewField>,
    );

    expect(markup).toContain('id="fullName-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Enter a fictional full name.");
  });

  it("keeps raw sensitive values out of Review HTML", () => {
    const data: EnrollmentData = {
      requirements: {
        identificationCardAvailable: true,
        familyCardAvailable: true,
        phoneNumberAvailable: true,
        emailAddressReady: true,
      },
      familyCardNumber: "3273000000003210",
      relationship: "self",
      fullName: "Budi Santoso",
      dateOfBirth: "1959-04-12",
      phoneNumber: "081200000123",
      facilityId: "taman-sari",
    };
    const markup = renderToStaticMarkup(
      <VoiceGuideProvider>
        <ReviewScreen
          data={data}
          demoCompleted={false}
          onComplete={() => undefined}
          onEdit={() => undefined}
          onPrevious={() => undefined}
          onResetRequest={() => undefined}
          onReviewInformation={() => undefined}
        />
      </VoiceGuideProvider>,
    );

    expect(markup).toContain("•••• •••• •••• 3210");
    expect(markup).toContain("•••• •••• 0123");
    expect(markup).not.toContain("3273000000003210");
    expect(markup).not.toContain("081200000123");
    expect(markup).toContain("Edit section");
    expect(markup).toContain("Independent hackathon prototype.");
  });

  it("exposes text status, one polite announcer, and non-live partial captions", () => {
    const markup = renderToStaticMarkup(
      <VoiceGuideView
        screenId="requirements"
        state={{
          ...initialVoiceState,
          status: "listening",
          userCaption: "A partial user caption",
          agentCaption: "Please confirm the first requirement.",
        }}
        start={() => undefined}
        end={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Voice Guide status: Listening"');
    expect(markup.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(markup).toContain("AksesSuara says: Please confirm the first requirement.");
    expect(markup).toContain('class="captions"');
    expect(markup).not.toContain('class="captions" aria-live');
  });

  it("renders every Voice Guide lifecycle state as visible text", () => {
    for (const [status, label] of [
      ["off", "Off"],
      ["connecting", "Connecting"],
      ["listening", "Listening"],
      ["thinking", "Thinking"],
      ["speaking", "Speaking"],
      ["error", "Error"],
    ] as const) {
      const markup = renderToStaticMarkup(
        <VoiceGuideView
          screenId="requirements"
          state={{
            ...initialVoiceState,
            status,
            errorCode: status === "error" ? "connection-failed" : null,
          }}
          start={() => undefined}
          end={() => undefined}
        />,
      );
      expect(markup).toContain(`Voice Guide status: ${label}`);
      expect(markup).toContain(`>${label}<`);
    }
  });

  it("announces a sensitive-content notice without announcing partial user speech", () => {
    const markup = renderToStaticMarkup(
      <VoiceGuideView
        screenId="family-information"
        state={{
          ...initialVoiceState,
          status: "listening",
          userCaption: "[Sensitive number removed]",
          safetyNotice:
            "For privacy, enter sensitive numbers in the visible field instead of saying them.",
        }}
        start={() => undefined}
        end={() => undefined}
      />,
    );

    expect(markup.match(/aria-live="polite"/g)).toHaveLength(1);
    expect(markup).toContain(
      "For privacy, enter sensitive numbers in the visible field instead of saying them.",
    );
    const liveRegion = markup.match(/<p class="sr-only"[^>]*>(.*?)<\/p>/)?.[1];
    expect(liveRegion).not.toContain("[Sensitive number removed]");
  });

  it("renders recoverable permission, connection, and timeout errors", () => {
    for (const [errorCode, message] of [
      ["permission-denied", "Microphone access was denied"],
      ["connection-failed", "could not connect"],
      ["agent-timeout", "took too long to start"],
    ] as const) {
      const markup = renderToStaticMarkup(
        <VoiceGuideView
          screenId="requirements"
          state={{ ...initialVoiceState, status: "error", errorCode }}
          start={() => undefined}
          end={() => undefined}
        />,
      );
      expect(markup).toContain(message);
      expect(markup).toContain("Retry connection");
      expect(markup).toContain('role="alert"');
    }
  });

  it("presents blocked tool feedback as expected attention, not a provider error", () => {
    const markup = renderToStaticMarkup(
      <VoiceGuideView
        screenId="requirements"
        state={{
          ...initialVoiceState,
          status: "listening",
          toolFeedback: "Please complete the email requirement.",
          toolFeedbackKind: "attention",
        }}
        start={() => undefined}
        end={() => undefined}
      />,
    );

    expect(markup).toContain("voice-tool-feedback--attention");
    expect(markup).toContain("Please complete the email requirement.");
    expect(markup).not.toMatch(/generic error|encountered an error/i);
  });

  it("gives voice controls accessible text and correct disabled states", () => {
    const markup = renderToStaticMarkup(
      <VoiceGuideView
        screenId="requirements"
        state={initialVoiceState}
        start={() => undefined}
        end={() => undefined}
      />,
    );

    expect(markup).toContain("Start voice guidance");
    expect(markup).toMatch(/disabled=""[^>]*>[\s\S]*Repeat/);
    expect(markup).toMatch(/disabled=""[^>]*>[\s\S]*Speak more slowly/);
    expect(markup).toMatch(/disabled=""[^>]*>[\s\S]*End Guidance/);
  });

  it("exposes the current enrollment step semantically", () => {
    const markup = renderToStaticMarkup(<EnrollmentProgress currentStep={3} />);
    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain("Step 3 of 5 · Participant information");
  });
});

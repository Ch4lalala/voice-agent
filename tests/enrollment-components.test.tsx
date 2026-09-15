import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PreviewField } from "../src/components/enrollment/PreviewField";
import { ReviewScreen } from "../src/components/enrollment/screens/ReviewScreen";
import { SensitiveInput } from "../src/components/enrollment/SensitiveInput";
import { VoiceGuideProvider } from "../src/components/voice/VoiceGuideProvider";
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
      phoneNumber: "081234567890",
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
    expect(markup).toContain("•••• •••• 7890");
    expect(markup).not.toContain("3273000000003210");
    expect(markup).not.toContain("081234567890");
    expect(markup).toContain("Edit section");
    expect(markup).toContain("Independent hackathon prototype.");
  });
});

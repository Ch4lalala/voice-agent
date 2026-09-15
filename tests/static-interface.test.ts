import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { enrollmentSteps } from "../src/types/enrollment";

const readProjectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

const requiredDisclaimer =
  "Independent hackathon prototype. This project is not affiliated with, endorsed by, or officially integrated with BPJS Kesehatan. It uses simulated screens and dummy data to demonstrate a proposed voice-assisted enrollment experience.";

describe("AksesSuara interface boundaries", () => {
  it("retains every required enrollment screen", () => {
    expect(["welcome", ...enrollmentSteps]).toEqual([
      "welcome",
      "requirements",
      "family-information",
      "participant-information",
      "facility-selection",
      "review",
    ]);
  });

  it("includes the exact disclaimer on Welcome and Review", () => {
    expect(readProjectFile("src/components/enrollment/screens/WelcomeScreen.tsx")).toContain(
      requiredDisclaimer,
    );
    expect(readProjectFile("src/components/enrollment/screens/ReviewScreen.tsx")).toContain(
      requiredDisclaimer,
    );
  });

  it("removes query-string preview routing", () => {
    const page = readProjectFile("src/app/page.tsx");
    const workflow = readProjectFile(
      "src/components/enrollment/EnrollmentWorkflow.tsx",
    );

    expect(`${page}\n${workflow}`).not.toMatch(/searchParams|\?screen=|PreviewNavigation/);
  });

  it("keeps product source free from persistence and Phase 4 screen awareness", () => {
    const productSource = [
      "src/app/page.tsx",
      "src/components/voice/VoiceGuide.tsx",
      "src/components/voice/VoiceGuideProvider.tsx",
      "src/components/enrollment/EnrollmentWorkflow.tsx",
      "src/lib/enrollment-machine.ts",
      "src/lib/enrollment-context.ts",
      "src/lib/voice-agent-client.ts",
    ]
      .map(readProjectFile)
      .join("\n");

    expect(productSource).not.toMatch(
      /localStorage|sessionStorage|document\.cookie|indexedDB/i,
    );
    const voiceSource = [
      "src/components/voice/VoiceGuide.tsx",
      "src/components/voice/VoiceGuideProvider.tsx",
      "src/lib/voice-agent-client.ts",
    ]
      .map(readProjectFile)
      .join("\n");
    expect(voiceSource).not.toMatch(/EnrollmentScreenContext|data-context-|tool\.result/i);
  });
});

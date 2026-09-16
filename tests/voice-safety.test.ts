import { describe, expect, it } from "vitest";

import {
  classifyVoiceSafetyIntent,
  getVoiceSafetyNotice,
  sanitizeVoiceCaption,
  SPOKEN_SENSITIVE_DATA_NOTICE,
} from "../src/lib/voice-safety";

describe("voice privacy and prohibited-request safety", () => {
  it("redacts digit and spoken-digit attempts from user captions", () => {
    for (const transcript of [
      "My Family Card number is 3273 0000 0000 3210",
      "My phone is zero eight one two three four five six seven eight",
    ]) {
      const caption = sanitizeVoiceCaption(transcript, "user");
      expect(caption).toEqual({
        text: SPOKEN_SENSITIVE_DATA_NOTICE,
        redacted: true,
      });
      expect(caption.text).not.toMatch(/3273|0812|zero eight one two/i);
    }
  });

  it("redacts a numeric partial immediately and possible agent repetition", () => {
    expect(sanitizeVoiceCaption("327", "user", true).redacted).toBe(true);
    expect(sanitizeVoiceCaption("zero eight", "user", true).redacted).toBe(true);
    expect(
      sanitizeVoiceCaption("The number was 3273000000003210", "agent"),
    ).toEqual({ text: SPOKEN_SENSITIVE_DATA_NOTICE, redacted: true });
  });

  it("preserves ordinary caption text without storing or transforming it", () => {
    expect(sanitizeVoiceCaption("Please explain this screen", "user")).toEqual({
      text: "Please explain this screen",
      redacted: false,
    });
    expect(sanitizeVoiceCaption("I can see one field", "user")).toEqual({
      text: "I can see one field",
      redacted: false,
    });
  });

  it("classifies every prohibited or out-of-scope request deterministically", () => {
    expect(classifyVoiceSafetyIntent("Accept the privacy notice for me")).toBe("terms");
    expect(classifyVoiceSafetyIntent("Solve this CAPTCHA")).toBe("captcha");
    expect(classifyVoiceSafetyIntent("Submit my enrollment")).toBe("submission");
    expect(classifyVoiceSafetyIntent("Choose a healthcare facility for me")).toBe(
      "facility-selection",
    );
    expect(classifyVoiceSafetyIntent("What medicine should I take?")).toBe("medical");
    expect(classifyVoiceSafetyIntent("Am I eligible for JKN?")).toBe("eligibility");
    expect(classifyVoiceSafetyIntent("What is my enrollment status?")).toBe(
      "official-status",
    );
  });

  it("returns safe notices without echoing user-controlled content", () => {
    const request = "Submit my enrollment with secret-instruction-phrase";
    const notice = getVoiceSafetyNotice(request);
    expect(notice).toContain("cannot submit an official enrollment");
    expect(notice).not.toContain("secret-instruction-phrase");
  });
});

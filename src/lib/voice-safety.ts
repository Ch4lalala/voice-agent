export const SPOKEN_SENSITIVE_DATA_NOTICE =
  "For your privacy, that spoken value was hidden. Please type sensitive information into the visible field instead.";

const numberWordSequence =
  /\b(?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b[\s,.-]*){4,}/i;
const numberWord = /\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/i;
const digitContent = /\d/;
const longDigitSequence = /(?:\d[\s().+-]*){4,}/;
const sensitiveLabel =
  /\b(?:family card|identification|identity|id|phone|telephone|mobile|date of birth)\s*(?:number|value|is|:)?/i;

export type VoiceSafetyIntent =
  | "sensitive-data"
  | "terms"
  | "captcha"
  | "submission"
  | "facility-selection"
  | "medical"
  | "eligibility"
  | "official-status";

const safetyNotices: Record<VoiceSafetyIntent, string> = {
  "sensitive-data": SPOKEN_SENSITIVE_DATA_NOTICE,
  terms:
    "Only you can accept terms or privacy notices. Use the visible application control yourself.",
  captcha:
    "The Voice Guide cannot solve or bypass a CAPTCHA. Complete any verification yourself.",
  submission:
    "This independent prototype cannot submit an official enrollment. It stops at demo review.",
  "facility-selection":
    "A healthcare facility is your choice. Select and explicitly confirm a fictional option using the visible controls.",
  medical:
    "The Voice Guide cannot provide medical advice. Use an appropriate healthcare professional or official service.",
  eligibility:
    "This demo cannot determine JKN eligibility. Check with official BPJS Kesehatan support.",
  "official-status":
    "This demo cannot check official enrollment or account status. Check through official BPJS Kesehatan channels.",
};

export function containsSpokenSensitiveData(text: string): boolean {
  return (
    longDigitSequence.test(text) ||
    numberWordSequence.test(text) ||
    (sensitiveLabel.test(text) && digitContent.test(text))
  );
}

export function sanitizeVoiceCaption(
  text: string,
  speaker: "user" | "agent",
  partial = false,
): { text: string; redacted: boolean } {
  const shouldRedact =
    speaker === "user"
      ? containsSpokenSensitiveData(text) ||
        (partial && (digitContent.test(text) || numberWord.test(text)))
      : longDigitSequence.test(text) || numberWordSequence.test(text);

  return shouldRedact
    ? { text: SPOKEN_SENSITIVE_DATA_NOTICE, redacted: true }
    : { text, redacted: false };
}

export function classifyVoiceSafetyIntent(text: string): VoiceSafetyIntent | null {
  if (containsSpokenSensitiveData(text)) return "sensitive-data";
  if (/\bcaptcha\b/i.test(text)) return "captcha";
  if (
    /\b(?:accept|agree|consent)\b[^.?!]*(?:terms|privacy|notice|policy)/i.test(text)
  ) {
    return "terms";
  }
  if (
    /\b(?:submit|send)\b[^.?!]*(?:enrollment|registration|application|form)|\bregister me\b/i.test(
      text,
    )
  ) {
    return "submission";
  }
  if (
    /\b(?:choose|select|pick|confirm|change)\b[^.?!]*(?:facility|clinic|healthcare)/i.test(
      text,
    )
  ) {
    return "facility-selection";
  }
  if (/\b(?:diagnos\w*|treat(?:ment)?|medicine|medication|medical advice)\b/i.test(text)) {
    return "medical";
  }
  if (/\b(?:eligible|eligibility|qualif(?:y|ied|ication))\b/i.test(text)) {
    return "eligibility";
  }
  if (
    /\b(?:official|account|enrollment|registration)\s+status\b|\bam i registered\b/i.test(
      text,
    )
  ) {
    return "official-status";
  }
  return null;
}

export function getVoiceSafetyNotice(text: string): string | null {
  const intent = classifyVoiceSafetyIntent(text);
  return intent ? safetyNotices[intent] : null;
}

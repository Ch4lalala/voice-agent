import type { EnrollmentFieldId } from "@/types/enrollment";

interface HighlightClassList {
  add(name: string): void;
  remove(name: string): void;
}

interface HighlightTarget {
  classList: HighlightClassList;
  scrollIntoView(options: ScrollIntoViewOptions): void;
}

interface HighlightControl {
  closest(selector: string): HighlightTarget | null;
  focus(options?: FocusOptions): void;
}

export interface VoiceHighlightDocument {
  getElementById(id: string): HighlightControl | null;
  querySelector(selector: string): HighlightControl | null;
}

export function applyVoiceFieldHighlight(
  ownerDocument: VoiceHighlightDocument,
  fieldId: EnrollmentFieldId,
  reducedMotion: boolean,
): (() => void) | null {
  const control =
    fieldId === "facilityId"
      ? ownerDocument.querySelector('input[name="facility"]')
      : ownerDocument.getElementById(fieldId);
  const target = control?.closest(
    ".field-group, .checklist__item, .facility-list",
  );
  if (!control || !target) return null;

  target.classList.add("voice-tool-highlight");
  control.focus({ preventScroll: true });
  target.scrollIntoView({
    behavior: reducedMotion ? "auto" : "smooth",
    block: "center",
  });

  return () => target.classList.remove("voice-tool-highlight");
}


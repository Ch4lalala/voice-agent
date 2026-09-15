import { useState, type ChangeEvent } from "react";

import { maskSensitiveValue } from "@/lib/masking";

type SensitiveInputProps = {
  autoComplete?: string;
  error?: string;
  fieldId: string;
  inputMode: "numeric" | "tel";
  name: string;
  maxLength: number;
  onChange: (value: string) => void;
  placeholder: string;
  type: "text" | "tel";
  value: string;
  visibleDigits?: number;
};

export function SensitiveInput({
  autoComplete = "off",
  error,
  fieldId,
  inputMode,
  name,
  maxLength,
  onChange,
  placeholder,
  type,
  value,
  visibleDigits = 4,
}: SensitiveInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const describedBy = `${fieldId}-hint${error ? ` ${fieldId}-error` : ""}`;
  const displayValue = isEditing ? value : maskSensitiveValue(value, visibleDigits);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    if (isEditing) onChange(event.target.value);
  }

  return (
    <input
      id={fieldId}
      name={name}
      maxLength={maxLength}
      className="text-input sensitive-input"
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onFocus={() => setIsEditing(true)}
      onBlur={() => setIsEditing(false)}
      aria-describedby={describedBy}
      aria-invalid={Boolean(error)}
      required
    />
  );
}

import type { ReactNode } from "react";

type PreviewFieldProps = {
  children: ReactNode;
  error?: string;
  fieldId: string;
  hint: string;
  label: string;
  required?: boolean;
  sensitive?: boolean;
};

export function PreviewField({
  children,
  error,
  fieldId,
  hint,
  label,
  required = false,
  sensitive = false,
}: PreviewFieldProps) {
  return (
    <div className="field-group">
      <div className="field-group__heading">
        <label htmlFor={fieldId}>
          {label}
          {required ? <span aria-label="required"> *</span> : null}
        </label>
        {sensitive ? <span className="privacy-badge">Type only</span> : null}
      </div>
      {children}
      <p id={`${fieldId}-hint`} className="field-hint">
        {hint}
      </p>
      {error ? (
        <p id={`${fieldId}-error`} className="field-error" role="alert">
          <span aria-hidden="true">!</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

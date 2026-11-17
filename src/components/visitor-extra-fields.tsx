"use client";
import { Field, Input, Select } from "./ui";

/** Organization-specific booking fields, e.g. "I am a: Student / Parent…" and "Student UID / Application No." */
export type VisitorFieldConfig = { visitorCategories: string[]; referenceLabel: string | null };

export function VisitorExtraFields({ config }: { config: VisitorFieldConfig }) {
  if (!config.visitorCategories.length && !config.referenceLabel) return null;
  return (
    <>
      {config.visitorCategories.length > 0 && (
        <Field label="I am a">
          <Select name="visitorCategory" required defaultValue="">
            <option value="" disabled>Select…</option>
            {config.visitorCategories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      )}
      {config.referenceLabel && (
        <Field label={`${config.referenceLabel} (optional)`}>
          <Input name="referenceNo" maxLength={60} />
        </Field>
      )}
    </>
  );
}

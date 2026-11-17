export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const isExclusionViolation = (e: unknown) => {
  const s = String((e as { message?: string })?.message ?? e) + JSON.stringify(e ?? {});
  return s.includes("23P01") || s.includes("appointments_no_overlap");
};

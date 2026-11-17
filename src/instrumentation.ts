/** Runs once when the Next.js server starts: launches the background jobs (reminders, auto no-show). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_JOBS === "true" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startJobs } = await import("./lib/jobs");
  startJobs();
}

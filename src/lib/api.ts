import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Wraps a route handler and converts thrown errors into JSON responses */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) return fail(e.status, e.code, e.message);
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const field = first?.path.join(".");
        return fail(422, "VALIDATION", field ? `${field}: ${first.message}` : first?.message ?? "Invalid input");
      }
      console.error(e);
      return fail(500, "INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("BAD_JSON", "Request body must be valid JSON", 400);
  }
}

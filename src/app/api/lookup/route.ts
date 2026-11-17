import { prisma } from "@/lib/db";
import { fail, handle, ok, readJson } from "@/lib/api";
import { lookupSchema } from "@/lib/validation";
import { PUBLIC_BOOKING } from "@/lib/config";

/** Visitor "find my booking": token number + mobile number → manage code */
export const POST = handle(async (req: Request) => {
  if (!PUBLIC_BOOKING) return fail(404, "NOT_FOUND", "Not available");
  const d = lookupSchema.parse(await readJson(req));
  const phone = d.phone.replace(/[^\d+]/g, "");
  const t = await prisma.token.findFirst({
    where: { tokenNumber: d.token.toUpperCase(), appointment: { organization: { slug: d.org }, visitor: { phone } } },
    include: { appointment: { select: { manageCode: true } } },
  });
  if (!t) return fail(404, "NOT_FOUND", "No booking matches that token and mobile number");
  return ok({ manageCode: t.appointment.manageCode });
});

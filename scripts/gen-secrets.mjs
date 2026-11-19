// Prints fresh production secrets to paste into Vercel's Environment Variables.
// Run: node scripts/gen-secrets.mjs   (never commit the output)
import { randomBytes } from "node:crypto";
import { generateVAPIDKeys } from "web-push";

const keys = generateVAPIDKeys();
const rand = (n) => randomBytes(n).toString("base64url");

console.log(`AUTH_SECRET=${rand(32)}`);
console.log(`CRON_SECRET=${rand(24)}`);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`CLIENT_INITIAL_PASSWORD=${rand(9)}A1`);

import { webcrypto } from "node:crypto";

/**
 * Makes a VAPID key pair for streak reminders and prints it for `.dev.vars` (gitignored) or for Worker secrets.
 * It prints to this terminal only and writes no file. Never commit the private key.
 */
const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicRaw = Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey));
const privateJwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`VAPID_PUBLIC_KEY="${publicRaw.toString("base64url")}"`);
console.log(`VAPID_PRIVATE_KEY="${privateJwk.d}"`);

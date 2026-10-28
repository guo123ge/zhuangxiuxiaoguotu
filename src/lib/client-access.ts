import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export type ShareLinkState = {
  revokedAt: Date | null;
  expiresAt: Date | null;
};

export function makeShareToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashShareToken(token) };
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashAccessCode(accessCode: string) {
  return createHash("sha256").update(accessCode.trim()).digest("hex");
}

export function isAccessCodeValid(
  accessCode: string,
  expectedHash: string | null,
) {
  if (!expectedHash) return true;
  const actual = Buffer.from(hashAccessCode(accessCode), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function makeAccessCookie(token: string) {
  const secret = process.env.CLIENT_ACCESS_SECRET;
  if (!secret) throw new Error("客户端访问码功能未配置 CLIENT_ACCESS_SECRET。");
  const tokenHash = hashShareToken(token);
  const signature = createHmac("sha256", secret).update(tokenHash).digest("hex");
  return `${tokenHash}.${signature}`;
}

export function isAccessCookieValid(
  token: string,
  cookieValue: string | undefined,
) {
  if (!cookieValue || !process.env.CLIENT_ACCESS_SECRET) return false;
  const [tokenHash, signature] = cookieValue.split(".");
  if (!tokenHash || !signature || tokenHash !== hashShareToken(token))
    return false;
  const expected = createHmac("sha256", process.env.CLIENT_ACCESS_SECRET)
    .update(tokenHash)
    .digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isShareLinkActive(link: ShareLinkState, now = new Date()) {
  if (link.revokedAt) return false;
  if (link.expiresAt && link.expiresAt <= now) return false;
  return true;
}

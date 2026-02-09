import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signAccessToken({ userId }) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken() {
  return randomBytes(32).toString("hex");
}

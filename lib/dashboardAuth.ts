import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const DASHBOARD_COOKIE = "dash_session";

const SESSION_DAYS = 30;
const SESSION_SCOPE = "710-dashboard-v1";

function pin() {
  return (process.env.DASHBOARD_PIN || "").trim();
}

export function isPinConfigured() {
  return pin().length > 0;
}

export type DashboardGate = "needs-pin" | "misconfigured" | "open";

/**
 * Si falta DASHBOARD_PIN en produccion el dashboard queda cerrado: un secreto
 * ausente nunca debe traducirse en desactivar la autenticacion en silencio.
 * En desarrollo si se deja pasar sin PIN para poder iterar.
 */
export function dashboardGate(): DashboardGate {
  if (isPinConfigured()) {
    return "needs-pin";
  }

  return process.env.NODE_ENV === "production" ? "misconfigured" : "open";
}

function sign(payload: string) {
  return createHmac("sha256", pin()).update(`${SESSION_SCOPE}.${payload}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function pinMatches(candidate: unknown) {
  const expected = pin();
  if (!expected || typeof candidate !== "string") {
    return false;
  }

  return safeEqual(candidate.trim(), expected);
}

export function createSessionToken() {
  const expiresAt = String(Date.now() + SESSION_DAYS * 86_400_000);
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function isValidSessionToken(token: unknown) {
  if (!isPinConfigured() || typeof token !== "string") {
    return false;
  }

  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature) {
    return false;
  }

  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < Date.now()) {
    return false;
  }

  return safeEqual(signature, sign(expiresAt));
}

export async function hasDashboardSession() {
  const store = await cookies();
  return isValidSessionToken(store.get(DASHBOARD_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};

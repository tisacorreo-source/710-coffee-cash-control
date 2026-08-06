import { NextResponse } from "next/server";

import {
  DASHBOARD_COOKIE,
  createSessionToken,
  isPinConfigured,
  pinMatches,
  sessionCookieOptions,
} from "@/lib/dashboardAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isPinConfigured()) {
    return NextResponse.json(
      { message: "El dashboard no tiene PIN configurado (DASHBOARD_PIN)." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (!pinMatches(body.pin)) {
    return NextResponse.json({ message: "PIN incorrecto." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_COOKIE, createSessionToken(), sessionCookieOptions);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}

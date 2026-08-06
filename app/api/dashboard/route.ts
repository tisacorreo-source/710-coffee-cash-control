import { NextResponse } from "next/server";

import { dashboardGate, hasDashboardSession } from "@/lib/dashboardAuth";
import { getDashboardSnapshot } from "@/lib/googleWorkspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = dashboardGate();

  if (gate === "misconfigured") {
    return NextResponse.json(
      { message: "Falta configurar DASHBOARD_PIN." },
      { status: 503 },
    );
  }

  if (gate === "needs-pin" && !(await hasDashboardSession())) {
    return NextResponse.json({ message: "Sesión no autorizada." }, { status: 401 });
  }

  try {
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron leer los datos del dashboard.",
      },
      { status: 500 },
    );
  }
}

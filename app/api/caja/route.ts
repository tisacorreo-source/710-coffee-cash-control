import { NextResponse } from "next/server";

import { getCashState } from "@/lib/googleWorkspace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cashState = await getCashState();
    return NextResponse.json(cashState);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el saldo de caja.",
      },
      { status: 500 },
    );
  }
}

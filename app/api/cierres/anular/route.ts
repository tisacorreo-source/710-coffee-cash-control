import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  appendAnnulmentRecord,
  deleteClosingRecord,
} from "@/lib/googleWorkspace";

export const runtime = "nodejs";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const configuredPin = process.env.MANAGER_ANNUL_PIN || "0710";
    const managerPin = text(body.managerPin);
    const reason = text(body.reason);
    const recordId = text(body.recordId);

    if (managerPin !== configuredPin) {
      return NextResponse.json(
        { message: "PIN manager incorrecto." },
        { status: 403 },
      );
    }

    if (!reason) {
      return NextResponse.json(
        { message: "Falta describir la razón de la anulación." },
        { status: 400 },
      );
    }

    const deleteResult = await deleteClosingRecord(recordId);
    const annulmentResult = await appendAnnulmentRecord({
      annulmentId: randomUUID(),
      recordId,
      createdAt: new Date().toISOString(),
      reason,
      deleted: deleteResult.deleted,
      mode: deleteResult.mode,
    });

    return NextResponse.json({
      ok: true,
      deleted: deleteResult.deleted,
      persisted: deleteResult.persisted || annulmentResult.persisted,
      mode: deleteResult.mode,
      driveFileId: annulmentResult.driveFileId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "No se pudo anular el cierre.",
      },
      { status: 500 },
    );
  }
}

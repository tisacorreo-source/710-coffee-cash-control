import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  appendWithdrawalRecord,
  getCashState,
  type WithdrawalRecord,
} from "@/lib/googleWorkspace";

export const runtime = "nodejs";

function amount(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

function hasPositiveAmount(value: unknown) {
  if (value === "" || value === null || value === undefined) return false;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const person = text(body.person);
    const shift = text(body.shift);
    const description = text(body.description);

    if (!person || !shift || !description || !hasPositiveAmount(body.amount)) {
      return NextResponse.json(
        { message: "Todos los campos del dinero retirado son obligatorios." },
        { status: 400 },
      );
    }

    const record: WithdrawalRecord = {
      withdrawalId: randomUUID(),
      createdAt: new Date().toISOString(),
      person,
      shift,
      amount: amount(body.amount),
      description,
    };

    const result = await appendWithdrawalRecord(record);
    const cashState = await getCashState();

    return NextResponse.json({
      ok: true,
      withdrawalId: record.withdrawalId,
      persisted: result.persisted,
      mode: result.mode,
      driveFileId: result.driveFileId,
      cashState,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el dinero retirado.",
      },
      { status: 500 },
    );
  }
}

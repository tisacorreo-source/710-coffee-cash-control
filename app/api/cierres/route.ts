import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  appendClosingRecord,
  type ClosingRecord,
} from "@/lib/googleWorkspace";

export const runtime = "nodejs";

const BASE_CASH = 1000;

function amount(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDenominations(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, rawValue]) => [key, amount(rawValue)]),
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const person = text(body.person);
    const shift = text(body.shift);
    const withdrawnCash = amount(body.withdrawnCash);
    const withdrawalDescription = text(body.withdrawalDescription);

    if (!person || !shift) {
      return NextResponse.json(
        { message: "Falta responsable o turno." },
        { status: 400 },
      );
    }

    if (withdrawnCash > 0 && !withdrawalDescription) {
      return NextResponse.json(
        { message: "Falta describir el dinero retirado." },
        { status: 400 },
      );
    }

    const cashSales = amount(body.cashSales);
    const denominations = cleanDenominations(body.denominations);
    const record: ClosingRecord = {
      recordId: randomUUID(),
      createdAt: new Date().toISOString(),
      person,
      shift,
      cashSales,
      cardSales: amount(body.cardSales),
      transferSales: amount(body.transferSales),
      uberSales: amount(body.uberSales),
      withdrawnCash,
      withdrawalDescription,
      expectedCash: BASE_CASH + cashSales - withdrawnCash,
      countedCash: amount(body.countedCash),
      denominations,
      notes: text(body.notes),
    };

    const result = await appendClosingRecord(record);

    return NextResponse.json({
      ok: true,
      recordId: record.recordId,
      persisted: result.persisted,
      mode: result.mode,
      driveFileId: result.driveFileId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "No se pudo guardar el cierre.",
      },
      { status: 500 },
    );
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  appendClosingRecord,
  getCashState,
  type ClosingRecord,
} from "@/lib/googleWorkspace";

export const runtime = "nodejs";

const denominationKeys = [
  "q200",
  "q100",
  "q50",
  "q20",
  "q10",
  "q5",
  "q1",
  "menores",
];

function optionalAmount(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

function hasAmount(value: unknown) {
  if (value === "" || value === null || value === undefined) return false;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDenominations(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { denominations: {}, missing: denominationKeys };
  }

  const denominations = Object.fromEntries(
    denominationKeys.map((key) => [
      key,
      hasAmount((value as Record<string, unknown>)[key])
        ? optionalAmount((value as Record<string, unknown>)[key])
        : 0,
    ]),
  );
  const missing = denominationKeys.filter(
    (key) => !hasAmount((value as Record<string, unknown>)[key]),
  );

  return { denominations, missing };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const person = text(body.person);
    const shift = text(body.shift);
    const notes = text(body.notes);

    if (
      !person ||
      !shift ||
      !notes ||
      !hasAmount(body.cashSales) ||
      !hasAmount(body.cardSales) ||
      !hasAmount(body.transferSales) ||
      !hasAmount(body.uberSales) ||
      !hasAmount(body.countedCash)
    ) {
      return NextResponse.json(
        { message: "Todos los campos del cierre son obligatorios." },
        { status: 400 },
      );
    }

    const { denominations, missing } = cleanDenominations(body.denominations);

    if (missing.length > 0) {
      return NextResponse.json(
        { message: "Todas las denominaciones son obligatorias." },
        { status: 400 },
      );
    }

    const cashSales = optionalAmount(body.cashSales);
    const cashState = await getCashState();
    const expectedCash = cashState.currentBalance + cashSales;
    const record: ClosingRecord = {
      recordId: randomUUID(),
      createdAt: new Date().toISOString(),
      person,
      shift,
      previousCash: cashState.currentBalance,
      cashSales,
      cardSales: optionalAmount(body.cardSales),
      transferSales: optionalAmount(body.transferSales),
      uberSales: optionalAmount(body.uberSales),
      expectedCash,
      countedCash: optionalAmount(body.countedCash),
      denominations,
      notes,
    };

    const result = await appendClosingRecord(record);

    return NextResponse.json({
      ok: true,
      recordId: record.recordId,
      persisted: result.persisted,
      mode: result.mode,
      driveFileId: result.driveFileId,
      expectedCash: record.expectedCash,
      previousCash: record.previousCash,
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

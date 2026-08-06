import { createSign, randomUUID } from "node:crypto";

export type CashMode = "local" | "sheets";

export type CashState = {
  baseCash: number;
  cashLimit: number;
  currentBalance: number;
  lastClosingAt: string | null;
  lastClosingId: string | null;
  mode: CashMode;
  persisted: boolean;
  standardWithdrawal: number;
  withdrawalsSinceLastClosing: number;
};

export type ClosingRecord = {
  recordId: string;
  createdAt: string;
  person: string;
  shift: string;
  previousCash: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  uberSales: number;
  expectedCash: number;
  countedCash: number;
  denominations: Record<string, number>;
  notes: string;
};

export type WithdrawalRecord = {
  withdrawalId: string;
  createdAt: string;
  person: string;
  shift: string;
  amount: number;
  description: string;
};

export type CancellationRecord = {
  cancellationId: string;
  createdAt: string;
  targetType: string;
  targetId: string;
  person: string;
  reason: string;
};

export type CashConfig = {
  baseCash: number;
  cashLimit: number;
  standardWithdrawal: number;
};

export type DashboardSnapshot = {
  generatedAt: string;
  mode: CashMode;
  config: CashConfig;
  closings: ClosingRecord[];
  withdrawals: WithdrawalRecord[];
  cancellations: CancellationRecord[];
  cashBalance: number;
  lastClosingAt: string | null;
};

type WorkspaceResult = {
  persisted: boolean;
  mode: CashMode;
  driveFileId?: string;
};

type LocalStore = {
  closings: ClosingRecord[];
  withdrawals: WithdrawalRecord[];
};

const BASE_CASH = 1000;
const CASH_LIMIT = 4000;
const STANDARD_WITHDRAWAL = 3000;

const CLOSING_HEADERS = [
  "record_id",
  "created_at",
  "responsable",
  "turno",
  "saldo_anterior",
  "ventas_efectivo",
  "ventas_tarjeta",
  "transferencias_otros",
  "uber_eats",
  "caja_esperada",
  "caja_contada",
  "observaciones",
  "denominaciones_json",
];

const WITHDRAWAL_HEADERS = [
  "withdrawal_id",
  "created_at",
  "responsable",
  "turno",
  "monto_retirado",
  "descripcion",
];

// estado_caja y anulaciones no llevan constante de encabezados: solo se leen,
// nunca se crean ni se reparan desde el codigo. El orden de columnas esperado
// esta en cashConfigFromRows y cancellationRecordsFromRows.

const DEFAULT_CASH_CONFIG: CashConfig = {
  baseCash: BASE_CASH,
  cashLimit: CASH_LIMIT,
  standardWithdrawal: STANDARD_WITHDRAWAL,
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function localStore() {
  const globalScope = globalThis as typeof globalThis & {
    __cashControlLocalStore?: LocalStore;
  };

  if (!globalScope.__cashControlLocalStore) {
    globalScope.__cashControlLocalStore = { closings: [], withdrawals: [] };
  }

  return globalScope.__cashControlLocalStore;
}

function googleConfig() {
  const serviceAccount = serviceAccountFromEnv();

  return {
    clientEmail:
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      serviceAccount.clientEmail ||
      "",
    privateKey: (
      process.env.GOOGLE_PRIVATE_KEY ||
      serviceAccount.privateKey ||
      ""
    ).replace(/\\n/g, "\n"),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    closingsSheet: process.env.GOOGLE_SHEETS_CLOSINGS_SHEET || "cierres",
    withdrawalsSheet: process.env.GOOGLE_SHEETS_WITHDRAWALS_SHEET || "retiros",
    configSheet: process.env.GOOGLE_SHEETS_CONFIG_SHEET || "estado_caja",
    cancellationsSheet:
      process.env.GOOGLE_SHEETS_CANCELLATIONS_SHEET || "anulaciones",
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
  };
}

function serviceAccountFromEnv() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawJson) {
    return { clientEmail: "", privateKey: "" };
  }

  try {
    const parsed = JSON.parse(rawJson) as {
      client_email?: string;
      private_key?: string;
    };

    return {
      clientEmail: parsed.client_email || "",
      privateKey: parsed.private_key || "",
    };
  } catch {
    return { clientEmail: "", privateKey: "" };
  }
}

function isWorkspaceConfigured() {
  const config = googleConfig();
  return Boolean(config.clientEmail && config.privateKey && config.spreadsheetId);
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signJwt() {
  const config = googleConfig();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope:
        "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const unsignedToken = `${header}.${claimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  return `${unsignedToken}.${base64Url(signer.sign(config.privateKey))}`;
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signJwt(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Google auth failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedAccessToken.token;
}

async function googleFetch(url: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google API ${response.status}: ${await response.text()}`);
  }

  return response;
}

function sheetRange(sheetName: string, range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${range}`;
}

async function getSheetId(sheetName: string) {
  const config = googleConfig();
  const metadataResponse = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}?fields=sheets(properties(sheetId,title))`,
  );
  const metadata = (await metadataResponse.json()) as {
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  };
  const existingSheet = metadata.sheets?.find(
    (sheet) => sheet.properties?.title === sheetName,
  );

  if (existingSheet?.properties?.sheetId !== undefined) {
    return existingSheet.properties.sheetId;
  }

  const createResponse = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    },
  );
  const created = (await createResponse.json()) as {
    replies?: Array<{ addSheet?: { properties?: { sheetId?: number } } }>;
  };

  const createdSheetId = created.replies?.[0]?.addSheet?.properties?.sheetId;
  if (createdSheetId === undefined) {
    throw new Error(`No se pudo crear la hoja ${sheetName}.`);
  }

  return createdSheetId;
}

async function ensureHeaderRow(sheetName: string, headers: string[]) {
  const config = googleConfig();
  await getSheetId(sheetName);

  const readResponse = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(
      sheetRange(sheetName, "A1:Z1"),
    )}`,
  );
  const readData = (await readResponse.json()) as { values?: string[][] };

  if (readData.values?.[0]?.[0] === headers[0]) {
    return;
  }

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(
      sheetRange(sheetName, "A1"),
    )}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [headers] }),
    },
  );
}

async function appendRow(sheetName: string, headers: string[], values: unknown[]) {
  const config = googleConfig();
  await ensureHeaderRow(sheetName, headers);

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(
      sheetRange(sheetName, "A1"),
    )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [values] }),
    },
  );
}

async function readRows(sheetName: string, headers: string[]) {
  await ensureHeaderRow(sheetName, headers);
  return readRowsOnly(sheetName);
}

/**
 * Lectura estrictamente pasiva: no crea la hoja ni escribe encabezados. La usa
 * el dashboard, que es de solo consulta y no debe tocar la hoja ni siquiera
 * para "arreglarla". Si la pestaña no existe devuelve vacio en lugar de fallar.
 */
async function readRowsOnly(sheetName: string) {
  const config = googleConfig();

  try {
    const response = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(
        sheetRange(sheetName, "A2:Z"),
      )}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const data = (await response.json()) as { values?: unknown[][] };
    return data.values || [];
  } catch (error) {
    console.warn(
      `No se pudo leer la hoja ${sheetName}.`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

async function writeDriveAuditFile(kind: string, payload: unknown) {
  const config = googleConfig();
  if (!config.driveFolderId) {
    return undefined;
  }

  const boundary = `codex-${randomUUID()}`;
  const fileName = `${kind}-${new Date().toISOString()}.json`;
  const metadata = {
    name: fileName,
    mimeType: "application/json",
    parents: [config.driveFolderId],
  };
  const media = JSON.stringify(payload, null, 2);
  const multipartBody = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    media,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const response = await googleFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    },
  );
  const data = (await response.json()) as { id?: string };

  return data.id;
}

async function tryWriteDriveAuditFile(kind: string, payload: unknown) {
  try {
    return await writeDriveAuditFile(kind, payload);
  } catch (error) {
    console.warn(
      `No se pudo guardar auditoria de ${kind} en Drive.`,
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

function parseAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return 0;
  }

  const numericText = trimmedValue.replace(/[^\d,.-]/g, "");
  const lastComma = numericText.lastIndexOf(",");
  const lastDot = numericText.lastIndexOf(".");
  const separatorMatches = numericText.match(/[,.]/g) || [];
  let decimalSeparator = "";

  if (lastComma >= 0 && lastDot >= 0) {
    decimalSeparator = lastComma > lastDot ? "," : ".";
  } else if (separatorMatches.length > 0) {
    const separator = separatorMatches[0] || "";
    const lastSeparator = numericText.lastIndexOf(separator);
    const digitsAfterSeparator = numericText.slice(lastSeparator + 1).length;
    decimalSeparator = digitsAfterSeparator === 3 ? "" : separator;
  }

  const normalizedText = decimalSeparator
    ? numericText
        .replace(new RegExp(`\\${decimalSeparator === "," ? "." : ","}`, "g"), "")
        .replace(decimalSeparator, ".")
    : numericText.replace(/[,.]/g, "");

  const numberValue = Number(normalizedText);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function parseTime(value: unknown) {
  if (!value) return 0;

  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const timestamp = excelEpoch + value * 24 * 60 * 60 * 1000;
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function balanceFromRecords(
  closings: ClosingRecord[],
  withdrawals: WithdrawalRecord[],
  config: CashConfig,
) {
  const sortedClosings = [...closings].sort(
    (a, b) => parseTime(a.createdAt) - parseTime(b.createdAt),
  );
  const lastClosing = sortedClosings.at(-1) || null;
  const lastClosingTime = parseTime(lastClosing?.createdAt || null);
  const baseBalance = lastClosing?.countedCash ?? config.baseCash;
  const withdrawalsSinceLastClosing = withdrawals
    .filter((withdrawal) => parseTime(withdrawal.createdAt) > lastClosingTime)
    .reduce((total, withdrawal) => total + withdrawal.amount, 0);

  return {
    lastClosing,
    withdrawalsSinceLastClosing,
    // Sin recorte a cero: un saldo negativo es una incidencia que el dashboard
    // debe poder mostrar, no un dato que se deba esconder.
    rawBalance: baseBalance - withdrawalsSinceLastClosing,
  };
}

function cashStateFromRecords(
  closings: ClosingRecord[],
  withdrawals: WithdrawalRecord[],
  mode: CashMode,
  config: CashConfig = DEFAULT_CASH_CONFIG,
): CashState {
  const { lastClosing, withdrawalsSinceLastClosing, rawBalance } =
    balanceFromRecords(closings, withdrawals, config);

  return {
    baseCash: config.baseCash,
    cashLimit: config.cashLimit,
    currentBalance: Math.max(rawBalance, 0),
    lastClosingAt: lastClosing?.createdAt || null,
    lastClosingId: lastClosing?.recordId || null,
    mode,
    persisted: mode === "sheets",
    standardWithdrawal: config.standardWithdrawal,
    withdrawalsSinceLastClosing,
  };
}

function safeText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function safeJson(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, number>;
  } catch {
    return {};
  }
}

function closingRecordsFromRows(rows: unknown[][]): ClosingRecord[] {
  return rows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      recordId: safeText(row[0]),
      createdAt: safeText(row[1]),
      person: safeText(row[2]),
      shift: safeText(row[3]),
      previousCash: parseAmount(row[4]),
      cashSales: parseAmount(row[5]),
      cardSales: parseAmount(row[6]),
      transferSales: parseAmount(row[7]),
      uberSales: parseAmount(row[8]),
      expectedCash: parseAmount(row[9]),
      countedCash: parseAmount(row[10]),
      notes: safeText(row[11]),
      denominations: safeJson(row[12]),
    }));
}

function withdrawalRecordsFromRows(rows: unknown[][]): WithdrawalRecord[] {
  return rows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      withdrawalId: safeText(row[0]),
      createdAt: safeText(row[1]),
      person: safeText(row[2]),
      shift: safeText(row[3]),
      amount: parseAmount(row[4]),
      description: safeText(row[5]),
    }));
}

function cancellationRecordsFromRows(rows: unknown[][]): CancellationRecord[] {
  return rows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      cancellationId: safeText(row[0]),
      createdAt: safeText(row[1]),
      targetType: safeText(row[2]),
      targetId: safeText(row[3]),
      person: safeText(row[4]),
      reason: safeText(row[5]),
    }));
}

function cashConfigFromRows(rows: unknown[][]): CashConfig {
  const values = new Map<string, number>();

  for (const row of rows) {
    const key = safeText(row[0]).trim();
    if (key) {
      values.set(key, parseAmount(row[1]));
    }
  }

  const pick = (key: string, fallback: number) => {
    const value = values.get(key);
    return value !== undefined && value > 0 ? value : fallback;
  };

  return {
    baseCash: pick("base_cash", DEFAULT_CASH_CONFIG.baseCash),
    cashLimit: pick("cash_limit", DEFAULT_CASH_CONFIG.cashLimit),
    standardWithdrawal: pick(
      "standard_withdrawal",
      DEFAULT_CASH_CONFIG.standardWithdrawal,
    ),
  };
}

async function readCashConfig(): Promise<CashConfig> {
  const config = googleConfig();

  try {
    return cashConfigFromRows(await readRowsOnly(config.configSheet));
  } catch (error) {
    console.warn(
      "No se pudo leer estado_caja; se usan los valores por defecto.",
      error instanceof Error ? error.message : error,
    );
    return DEFAULT_CASH_CONFIG;
  }
}

export async function getCashState(): Promise<CashState> {
  if (!isWorkspaceConfigured()) {
    const store = localStore();
    return cashStateFromRecords(store.closings, store.withdrawals, "local");
  }

  const config = googleConfig();
  const [closingRows, withdrawalRows, cashConfig] = await Promise.all([
    readRows(config.closingsSheet, CLOSING_HEADERS),
    readRows(config.withdrawalsSheet, WITHDRAWAL_HEADERS),
    readCashConfig(),
  ]);

  return cashStateFromRecords(
    closingRecordsFromRows(closingRows),
    withdrawalRecordsFromRows(withdrawalRows),
    "sheets",
    cashConfig,
  );
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!isWorkspaceConfigured()) {
    const store = localStore();
    const { lastClosing, rawBalance } = balanceFromRecords(
      store.closings,
      store.withdrawals,
      DEFAULT_CASH_CONFIG,
    );

    return {
      generatedAt: new Date().toISOString(),
      mode: "local",
      config: DEFAULT_CASH_CONFIG,
      closings: store.closings,
      withdrawals: store.withdrawals,
      cancellations: [],
      cashBalance: rawBalance,
      lastClosingAt: lastClosing?.createdAt || null,
    };
  }

  const config = googleConfig();
  // Solo lecturas pasivas: el dashboard nunca modifica la hoja.
  const [closingRows, withdrawalRows, cancellationRows, cashConfig] =
    await Promise.all([
      readRowsOnly(config.closingsSheet),
      readRowsOnly(config.withdrawalsSheet),
      readRowsOnly(config.cancellationsSheet),
      readCashConfig(),
    ]);

  const closings = closingRecordsFromRows(closingRows);
  const withdrawals = withdrawalRecordsFromRows(withdrawalRows);
  const { lastClosing, rawBalance } = balanceFromRecords(
    closings,
    withdrawals,
    cashConfig,
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: "sheets",
    config: cashConfig,
    closings,
    withdrawals,
    cancellations: cancellationRecordsFromRows(cancellationRows),
    cashBalance: rawBalance,
    lastClosingAt: lastClosing?.createdAt || null,
  };
}

export async function appendClosingRecord(
  record: ClosingRecord,
): Promise<WorkspaceResult> {
  if (!isWorkspaceConfigured()) {
    localStore().closings.push(record);
    return { persisted: false, mode: "local" };
  }

  const config = googleConfig();
  await appendRow(config.closingsSheet, CLOSING_HEADERS, [
    record.recordId,
    record.createdAt,
    record.person,
    record.shift,
    record.previousCash,
    record.cashSales,
    record.cardSales,
    record.transferSales,
    record.uberSales,
    record.expectedCash,
    record.countedCash,
    record.notes,
    JSON.stringify(record.denominations),
  ]);

  const driveFileId = await tryWriteDriveAuditFile("cierre", record);
  return { persisted: true, mode: "sheets", driveFileId };
}

export async function appendWithdrawalRecord(
  record: WithdrawalRecord,
): Promise<WorkspaceResult> {
  if (!isWorkspaceConfigured()) {
    localStore().withdrawals.push(record);
    return { persisted: false, mode: "local" };
  }

  const config = googleConfig();
  await appendRow(config.withdrawalsSheet, WITHDRAWAL_HEADERS, [
    record.withdrawalId,
    record.createdAt,
    record.person,
    record.shift,
    record.amount,
    record.description,
  ]);

  const driveFileId = await tryWriteDriveAuditFile("retiro", record);
  return { persisted: true, mode: "sheets", driveFileId };
}

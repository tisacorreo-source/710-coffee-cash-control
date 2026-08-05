import { createSign, randomUUID } from "node:crypto";

export type ClosingRecord = {
  recordId: string;
  createdAt: string;
  person: string;
  shift: string;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  uberSales: number;
  withdrawnCash: number;
  withdrawalDescription: string;
  expectedCash: number;
  countedCash: number;
  denominations: Record<string, number>;
  notes: string;
};

export type AnnulmentRecord = {
  annulmentId: string;
  recordId: string;
  createdAt: string;
  reason: string;
  deleted: boolean;
  mode: "local" | "sheets";
};

type WorkspaceResult = {
  persisted: boolean;
  mode: "local" | "sheets";
  driveFileId?: string;
};

type DeleteResult = WorkspaceResult & {
  deleted: boolean;
};

const CLOSING_HEADERS = [
  "record_id",
  "created_at",
  "responsable",
  "turno",
  "ventas_efectivo",
  "ventas_tarjeta",
  "transferencias_otros",
  "uber_eats",
  "dinero_retirado",
  "descripcion_retiro",
  "caja_esperada",
  "caja_contada",
  "observaciones",
  "denominaciones_json",
];

const ANNULMENT_HEADERS = [
  "annulment_id",
  "record_id",
  "created_at",
  "razon",
  "registro_borrado",
  "modo",
];

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function googleConfig() {
  return {
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
    closingsSheet: process.env.GOOGLE_SHEETS_CLOSINGS_SHEET || "cierres",
    annulmentsSheet:
      process.env.GOOGLE_SHEETS_ANNULMENTS_SHEET || "anulaciones",
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
  };
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
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [values] }),
    },
  );
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

export async function appendClosingRecord(
  record: ClosingRecord,
): Promise<WorkspaceResult> {
  if (!isWorkspaceConfigured()) {
    return { persisted: false, mode: "local" };
  }

  const config = googleConfig();
  await appendRow(config.closingsSheet, CLOSING_HEADERS, [
    record.recordId,
    record.createdAt,
    record.person,
    record.shift,
    record.cashSales,
    record.cardSales,
    record.transferSales,
    record.uberSales,
    record.withdrawnCash,
    record.withdrawalDescription,
    record.expectedCash,
    record.countedCash,
    record.notes,
    JSON.stringify(record.denominations),
  ]);

  const driveFileId = await writeDriveAuditFile("cierre", record);
  return { persisted: true, mode: "sheets", driveFileId };
}

export async function deleteClosingRecord(recordId: string): Promise<DeleteResult> {
  if (!recordId || !isWorkspaceConfigured()) {
    return { persisted: false, mode: "local", deleted: false };
  }

  const config = googleConfig();
  const sheetId = await getSheetId(config.closingsSheet);
  const rowsResponse = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(
      sheetRange(config.closingsSheet, "A:A"),
    )}`,
  );
  const rowsData = (await rowsResponse.json()) as { values?: string[][] };
  const rowIndex = rowsData.values?.findIndex((row) => row[0] === recordId) ?? -1;

  if (rowIndex < 1) {
    return { persisted: true, mode: "sheets", deleted: false };
  }

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      }),
    },
  );

  return { persisted: true, mode: "sheets", deleted: true };
}

export async function appendAnnulmentRecord(
  record: AnnulmentRecord,
): Promise<WorkspaceResult> {
  if (!isWorkspaceConfigured()) {
    return { persisted: false, mode: "local" };
  }

  const config = googleConfig();
  await appendRow(config.annulmentsSheet, ANNULMENT_HEADERS, [
    record.annulmentId,
    record.recordId,
    record.createdAt,
    record.reason,
    record.deleted ? "si" : "no",
    record.mode,
  ]);

  const driveFileId = await writeDriveAuditFile("anulacion", record);
  return { persisted: true, mode: "sheets", driveFileId };
}

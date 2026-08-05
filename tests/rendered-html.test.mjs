import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cash-control prototype separates closing and withdrawals", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Caja de turno/);
  assert.match(page, /Registrar cierre/);
  assert.match(page, /Dinero retirado/);
  assert.match(page, /Monto retirado/);
  assert.match(page, /Saldo anterior/);
  assert.match(page, /Caja esperada/);
  assert.match(page, /Caja contada/);
  assert.match(page, /Corte de caja pendiente/);
  assert.match(page, /Cierre enviado/);
  assert.match(page, /Dinero retirado enviado/);
  assert.match(page, /Todos los campos del cierre son obligatorios/);
  assert.doesNotMatch(page, /Abrir turno/);
  assert.doesNotMatch(page, /Movimiento de caja/);
  assert.doesNotMatch(page, /Corrección \/ Anulación/);
  assert.doesNotMatch(page, /Anular/);
  assert.doesNotMatch(page, /Descripción del dinero retirado/);
  assert.doesNotMatch(page, /registrado en modo local/);
  assert.doesNotMatch(page, /enviado a Sheets/);
  assert.doesNotMatch(page, /retiro sugerido/i);
});

test("backend exposes separate cash state and withdrawal routes", async () => {
  const cashRoute = await readFile(
    new URL("../app/api/caja/route.ts", import.meta.url),
    "utf8",
  );
  const withdrawalRoute = await readFile(
    new URL("../app/api/retiros/route.ts", import.meta.url),
    "utf8",
  );
  const workspace = await readFile(
    new URL("../lib/googleWorkspace.ts", import.meta.url),
    "utf8",
  );

  assert.match(cashRoute, /getCashState/);
  assert.match(withdrawalRoute, /appendWithdrawalRecord/);
  assert.match(workspace, /GOOGLE_SHEETS_WITHDRAWALS_SHEET/);
  assert.match(workspace, /GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.match(workspace, /STANDARD_WITHDRAWAL = 3000/);
  assert.match(workspace, /CASH_LIMIT = 4000/);
});

test("metadata is branded for the cash-control preview", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /710 Coffee Bar - Caja de turno/);
  assert.match(layout, /registrar cierres y dinero retirado/);
});

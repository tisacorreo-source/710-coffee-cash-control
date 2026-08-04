import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cash-control prototype includes the expected actions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Abrir turno/);
  assert.match(page, /Cerrar turno/);
  assert.match(page, /Movimiento de caja/);
  assert.match(page, /Corrección \/ Anulación/);
  assert.match(page, /Total de dinero en caja/);
  assert.match(page, /Enviar apertura/);
  assert.doesNotMatch(page, /Registros simulados|Google Sheets futuro/i);
});

test("metadata is branded for the client preview", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /710 Coffee Bar - Control de caja/);
  assert.match(layout, /Prototipo para apertura, movimientos y cierre de caja/);
});

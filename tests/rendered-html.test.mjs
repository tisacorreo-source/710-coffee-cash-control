import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cash-control prototype focuses only on shift closing", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Cierre de turno/);
  assert.match(page, /Registrar cierre/);
  assert.match(page, /Caja esperada/);
  assert.match(page, /Caja contada/);
  assert.match(page, /Dinero retirado/);
  assert.match(page, /Descripción del dinero retirado/);
  assert.match(page, /Anular/);
  assert.doesNotMatch(page, /Abrir turno/);
  assert.doesNotMatch(page, /Movimiento de caja/);
  assert.doesNotMatch(page, /Corrección \/ Anulación/);
  assert.doesNotMatch(page, /Dejar en caja/);
  assert.doesNotMatch(page, /Guardar aparte/);
  assert.doesNotMatch(page, /Diferencia/);
});

test("metadata is branded for the closing preview", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /710 Coffee Bar - Cierre de turno/);
  assert.match(layout, /Prototipo para registrar cierres de turno/);
});

import assert from "node:assert/strict";
import test from "node:test";

// El build de Next deja el TypeScript compilado; para probar la logica pura se
// importa el modulo directamente con el type stripping nativo de Node 22+.
const {
  buildAlerts,
  buildDailySeries,
  buildMovements,
  buildSales,
  closingsInRange,
  dayKey,
  daysInRange,
  formatTime,
  money,
  moneyCompact,
  previousRange,
  resolveRange,
  shiftDayKey,
} = await import("../lib/dashboardMetrics.ts");

function closing(overrides = {}) {
  return {
    recordId: "r1",
    createdAt: "2026-08-05T23:54:15.624Z",
    person: "David",
    shift: "Manana",
    previousCash: 1500,
    cashSales: 100,
    cardSales: 200,
    transferSales: 300,
    uberSales: 400,
    expectedCash: 1600,
    countedCash: 1600,
    denominations: {},
    notes: "",
    ...overrides,
  };
}

function withdrawal(overrides = {}) {
  return {
    withdrawalId: "w1",
    createdAt: "2026-08-05T23:54:54.081Z",
    person: "David",
    shift: "Tarde",
    amount: 500,
    description: "Corte",
    ...overrides,
  };
}

test("dayKey usa la fecha local de Guatemala, no UTC", () => {
  // 23:54 UTC del 5 de agosto siguen siendo las 17:54 del 5 en Guatemala.
  assert.equal(dayKey("2026-08-05T23:54:15.624Z"), "2026-08-05");
  // 02:30 UTC del 6 son las 20:30 del 5 en Guatemala: pertenece al dia anterior.
  assert.equal(dayKey("2026-08-06T02:30:00.000Z"), "2026-08-05");
  // 07:00 UTC del 6 son las 01:00 del 6 en Guatemala.
  assert.equal(dayKey("2026-08-06T07:00:00.000Z"), "2026-08-06");
});

test("formatTime muestra la hora local del local", () => {
  assert.equal(formatTime("2026-08-05T23:54:15.624Z"), "17:54");
});

test("shiftDayKey cruza fin de mes correctamente", () => {
  assert.equal(shiftDayKey("2026-08-01", -1), "2026-07-31");
  assert.equal(shiftDayKey("2026-02-28", 1), "2026-03-01");
  assert.equal(shiftDayKey("2026-08-06", -6), "2026-07-31");
});

test("resolveRange arma los periodos esperados", () => {
  const now = new Date("2026-08-06T18:00:00.000Z");

  assert.deepEqual(
    { ...resolveRange("hoy", undefined, now) },
    { key: "hoy", fromKey: "2026-08-06", toKey: "2026-08-06", label: "6 ago" },
  );

  const ayer = resolveRange("ayer", undefined, now);
  assert.equal(ayer.fromKey, "2026-08-05");
  assert.equal(ayer.toKey, "2026-08-05");

  const sevenDays = resolveRange("7d", undefined, now);
  assert.equal(sevenDays.fromKey, "2026-07-31");
  assert.equal(sevenDays.toKey, "2026-08-06");
  assert.equal(daysInRange(sevenDays), 7);

  const thirtyDays = resolveRange("30d", undefined, now);
  assert.equal(daysInRange(thirtyDays), 30);
});

test("resolveRange ordena un rango personalizado invertido", () => {
  const range = resolveRange("custom", { from: "2026-08-10", to: "2026-08-01" });
  assert.equal(range.fromKey, "2026-08-01");
  assert.equal(range.toKey, "2026-08-10");
});

test("previousRange devuelve el bloque anterior del mismo largo", () => {
  const now = new Date("2026-08-06T18:00:00.000Z");
  const previous = previousRange(resolveRange("7d", undefined, now));

  assert.equal(previous.toKey, "2026-07-30");
  assert.equal(previous.fromKey, "2026-07-24");
  assert.equal(daysInRange(previous), 7);
});

test("closingsInRange filtra por dia local", () => {
  const range = resolveRange("ayer", undefined, new Date("2026-08-06T18:00:00.000Z"));
  const closings = [
    closing({ recordId: "dentro", createdAt: "2026-08-06T02:30:00.000Z" }),
    closing({ recordId: "fuera", createdAt: "2026-08-06T07:00:00.000Z" }),
  ];

  const result = closingsInRange(closings, range);
  assert.equal(result.length, 1);
  assert.equal(result[0].recordId, "dentro");
});

test("buildSales suma metodos y reparte porcentajes", () => {
  const sales = buildSales([closing(), closing({ recordId: "r2" })]);

  assert.equal(sales.cash, 200);
  assert.equal(sales.card, 400);
  assert.equal(sales.total, 2000);
  assert.equal(sales.nonCash, 1800);

  const shares = sales.methods.reduce((total, slice) => total + slice.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-9);
  assert.equal(sales.methods.every((slice) => slice.color.startsWith("#")), true);
});

test("buildSales no divide entre cero cuando no hay ventas", () => {
  const sales = buildSales([]);
  assert.equal(sales.total, 0);
  assert.equal(sales.methods.every((slice) => slice.share === 0), true);
});

test("buildMovements marca entradas y salidas y omite cierres sin efectivo", () => {
  const movements = buildMovements(
    [closing(), closing({ recordId: "r2", cashSales: 0 })],
    [withdrawal()],
  );

  assert.equal(movements.length, 2);
  assert.equal(movements.filter((item) => item.direction === "in").length, 1);
  assert.equal(movements.filter((item) => item.direction === "out").length, 1);
  // Orden cronologico inverso: lo mas reciente primero.
  assert.ok(Date.parse(movements[0].at) >= Date.parse(movements[1].at));
});

test("buildDailySeries rellena los dias sin ventas con cero", () => {
  const range = resolveRange("7d", undefined, new Date("2026-08-06T18:00:00.000Z"));
  const series = buildDailySeries([closing()], range);

  assert.equal(series.length, 7);
  assert.equal(series.at(-1).dayKey, "2026-08-06");
  assert.equal(series.at(-1).total, 0);
  assert.equal(series.find((point) => point.dayKey === "2026-08-05").total, 1000);
});

test("buildAlerts avisa de saldo negativo antes que del limite", () => {
  const config = { baseCash: 1000, cashLimit: 4000, standardWithdrawal: 3000 };
  const alerts = buildAlerts({
    cashBalance: -250,
    config,
    closings: [],
    cancellations: [],
  });

  assert.equal(alerts[0].id, "saldo-negativo");
  assert.equal(alerts[0].severity, "critical");
});

test("buildAlerts avisa cuando la caja supera el limite", () => {
  const config = { baseCash: 1000, cashLimit: 4000, standardWithdrawal: 3000 };
  const alerts = buildAlerts({
    cashBalance: 8166,
    config,
    closings: [],
    cancellations: [],
  });

  assert.equal(alerts.some((alert) => alert.id === "sobre-limite"), true);
});

test("buildAlerts no inventa incidencias cuando todo esta en rango", () => {
  const config = { baseCash: 1000, cashLimit: 4000, standardWithdrawal: 3000 };
  const alerts = buildAlerts({
    cashBalance: 2500,
    config,
    closings: [closing({ notes: "" })],
    cancellations: [],
  });

  assert.deepEqual(alerts, []);
});

test("money y moneyCompact formatean con signo y quetzales", () => {
  assert.equal(money(1234.5), "Q1,234.50");
  assert.equal(money(-800), "-Q800.00");
  assert.equal(moneyCompact(83165), "Q83.2K");
  assert.equal(moneyCompact(1_250_000), "Q1.3M");
  assert.equal(moneyCompact(0), "Q0");
});

const { SHIFTS, shiftClass, shiftLabel } = await import("../lib/shifts.ts");

test("el negocio solo tiene turno de manana y tarde", () => {
  assert.deepEqual([...SHIFTS], ["Manana", "Tarde"]);
  assert.equal(SHIFTS.includes("Noche"), false);
});

test("shiftLabel muestra la enie sin cambiar el valor guardado", () => {
  assert.equal(shiftLabel("Manana"), "Mañana");
  assert.equal(shiftLabel("Tarde"), "Tarde");
  // Un turno desconocido se muestra tal cual, no se descarta ni se traduce.
  assert.equal(shiftLabel("Madrugada"), "Madrugada");
});

test("shiftClass no reconoce un turno de noche", () => {
  assert.equal(shiftClass("Manana"), "is-manana");
  assert.equal(shiftClass("Tarde"), "is-tarde");
  assert.equal(shiftClass("Noche"), "");
});

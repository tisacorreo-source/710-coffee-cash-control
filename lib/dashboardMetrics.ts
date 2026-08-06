import type {
  CancellationRecord,
  CashConfig,
  ClosingRecord,
  WithdrawalRecord,
} from "@/lib/googleWorkspace";
// Este modulo solo deriva datos: no arma texto de pantalla. El nombre visible
// del turno lo pone la capa de UI con shiftLabel(), asi este archivo se puede
// cargar tal cual desde los tests de Node sin arrastrar imports.

// Los registros se guardan en UTC, pero el negocio opera en Guatemala. "Hoy"
// tiene que significar el dia calendario del local, no el del servidor.
export const TIME_ZONE = "America/Guatemala";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const longDateFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export type PeriodKey = "hoy" | "ayer" | "7d" | "30d" | "custom";

export type DateRange = {
  key: PeriodKey;
  fromKey: string;
  toKey: string;
  label: string;
};

export type MethodKey = "efectivo" | "tarjeta" | "transferencias" | "uber";

export type MethodSlice = {
  key: MethodKey;
  label: string;
  /** Version corta para leyendas junto a una grafica, donde el ancho aprieta. */
  shortLabel: string;
  amount: number;
  share: number;
  color: string;
};

export type Movement = {
  id: string;
  at: string;
  direction: "in" | "out";
  type: string;
  concept: string;
  amount: number;
  person: string;
  shift: string;
};

export type ActivityItem = {
  id: string;
  at: string;
  kind: "cierre" | "retiro" | "anulacion";
  title: string;
  /** Turno crudo tal como esta en la hoja; la UI lo pasa por shiftLabel(). */
  shift: string;
  detail: string;
  amount: number | null;
  href: string | null;
};

export type AlertSeverity = "critical" | "warning" | "info";

export type Alert = {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  href: string | null;
};

export type DailyPoint = {
  dayKey: string;
  label: string;
  total: number;
};

// Slots 3, 1, 7 y 2 de la paleta categorica validada. El orden y los pasos
// pasan las seis comprobaciones sobre superficie blanca con --pairs all
// (peor par CVD dE 9.2, vision normal dE 16.3). El aqua queda por debajo de
// 3:1 de contraste, asi que la regla de relieve obliga a que cada segmento
// lleve monto y porcentaje escritos, como ya pide el brief.
export const METHOD_COLORS: Record<MethodKey, string> = {
  efectivo: "#1baf7a",
  tarjeta: "#2a78d6",
  transferencias: "#4a3aa7",
  uber: "#eb6834",
};

const METHOD_LABELS: Record<MethodKey, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencias: "Transferencias / Otros",
  uber: "Uber Eats",
};

const METHOD_SHORT_LABELS: Record<MethodKey, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencias: "Transf. / Otros",
  uber: "Uber Eats",
};

/** Acepta ISO, numero serial de Sheets o Date. Devuelve null si no es fecha. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86_400_000);
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }

  const serial = Number(value);
  if (Number.isFinite(serial)) {
    return toDate(serial);
  }

  return null;
}

export function dayKey(value: unknown): string {
  const date = toDate(value);
  return date ? dayKeyFormatter.format(date) : "";
}

export function formatTime(value: unknown): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "--:--";
}

export function formatShortDate(value: unknown): string {
  const date = toDate(value);
  return date ? shortDateFormatter.format(date) : "";
}

export function formatLongDate(value: unknown): string {
  const date = toDate(value);
  return date ? longDateFormatter.format(date) : "";
}

export function todayKey(now: Date = new Date()): string {
  return dayKeyFormatter.format(now);
}

export function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatDayKey(key: string): string {
  return key ? shortDateFormatter.format(dayKeyToDate(key)) : "";
}

export function resolveRange(
  period: PeriodKey,
  custom?: { from: string; to: string },
  now: Date = new Date(),
): DateRange {
  const today = todayKey(now);

  if (period === "custom" && custom?.from && custom?.to) {
    const [fromKey, toKey] =
      custom.from <= custom.to
        ? [custom.from, custom.to]
        : [custom.to, custom.from];

    return {
      key: "custom",
      fromKey,
      toKey,
      label:
        fromKey === toKey
          ? formatDayKey(fromKey)
          : `${formatDayKey(fromKey)} – ${formatDayKey(toKey)}`,
    };
  }

  if (period === "ayer") {
    const yesterday = shiftDayKey(today, -1);
    return {
      key: "ayer",
      fromKey: yesterday,
      toKey: yesterday,
      label: formatDayKey(yesterday),
    };
  }

  if (period === "7d" || period === "30d") {
    const span = period === "7d" ? 7 : 30;
    const fromKey = shiftDayKey(today, -(span - 1));
    return {
      key: period,
      fromKey,
      toKey: today,
      label: `${formatDayKey(fromKey)} – ${formatDayKey(today)}`,
    };
  }

  return {
    key: "hoy",
    fromKey: today,
    toKey: today,
    label: formatDayKey(today),
  };
}

/** Rango inmediatamente anterior y del mismo largo, para comparaciones. */
export function previousRange(range: DateRange): DateRange {
  const span = daysInRange(range);
  const toKey = shiftDayKey(range.fromKey, -1);
  const fromKey = shiftDayKey(toKey, -(span - 1));

  return { key: range.key, fromKey, toKey, label: "periodo anterior" };
}

export function daysInRange(range: DateRange): number {
  const from = dayKeyToDate(range.fromKey).getTime();
  const to = dayKeyToDate(range.toKey).getTime();
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

export function inRange(value: unknown, range: DateRange): boolean {
  const key = dayKey(value);
  return Boolean(key) && key >= range.fromKey && key <= range.toKey;
}

export function closingsInRange(closings: ClosingRecord[], range: DateRange) {
  return closings.filter((closing) => inRange(closing.createdAt, range));
}

export function withdrawalsInRange(
  withdrawals: WithdrawalRecord[],
  range: DateRange,
) {
  return withdrawals.filter((withdrawal) => inRange(withdrawal.createdAt, range));
}

export function cancellationsInRange(
  cancellations: CancellationRecord[],
  range: DateRange,
) {
  return cancellations.filter((item) => inRange(item.createdAt, range));
}

export function closingTotal(closing: ClosingRecord): number {
  return (
    closing.cashSales +
    closing.cardSales +
    closing.transferSales +
    closing.uberSales
  );
}

export type SalesBreakdown = {
  total: number;
  cash: number;
  card: number;
  transfer: number;
  uber: number;
  nonCash: number;
  methods: MethodSlice[];
};

export function buildSales(closings: ClosingRecord[]): SalesBreakdown {
  const cash = sum(closings, (closing) => closing.cashSales);
  const card = sum(closings, (closing) => closing.cardSales);
  const transfer = sum(closings, (closing) => closing.transferSales);
  const uber = sum(closings, (closing) => closing.uberSales);
  const total = cash + card + transfer + uber;

  const amounts: Record<MethodKey, number> = {
    efectivo: cash,
    tarjeta: card,
    transferencias: transfer,
    uber,
  };

  const methods = (Object.keys(amounts) as MethodKey[]).map((key) => ({
    key,
    label: METHOD_LABELS[key],
    shortLabel: METHOD_SHORT_LABELS[key],
    amount: amounts[key],
    share: total > 0 ? amounts[key] / total : 0,
    color: METHOD_COLORS[key],
  }));

  return { total, cash, card, transfer, uber, nonCash: card + transfer + uber, methods };
}

export function buildDailySeries(
  closings: ClosingRecord[],
  range: DateRange,
): DailyPoint[] {
  const totals = new Map<string, number>();

  for (const closing of closings) {
    const key = dayKey(closing.createdAt);
    if (key) {
      totals.set(key, (totals.get(key) || 0) + closingTotal(closing));
    }
  }

  const points: DailyPoint[] = [];
  const span = daysInRange(range);

  for (let index = 0; index < span; index += 1) {
    const key = shiftDayKey(range.fromKey, index);
    points.push({ dayKey: key, label: formatDayKey(key), total: totals.get(key) || 0 });
  }

  return points;
}

export function buildMovements(
  closings: ClosingRecord[],
  withdrawals: WithdrawalRecord[],
): Movement[] {
  const entries: Movement[] = [];

  for (const closing of closings) {
    // Solo el efectivo entra fisicamente a la caja; tarjeta y transferencias
    // no mueven el saldo, por eso no son movimientos de efectivo.
    if (closing.cashSales > 0) {
      entries.push({
        id: `cierre-${closing.recordId}`,
        at: closing.createdAt,
        direction: "in",
        type: "Venta",
        concept: "Cierre de turno",
        amount: closing.cashSales,
        person: closing.person,
        shift: closing.shift,
      });
    }
  }

  for (const withdrawal of withdrawals) {
    entries.push({
      id: `retiro-${withdrawal.withdrawalId}`,
      at: withdrawal.createdAt,
      direction: "out",
      type: "Retiro",
      concept: withdrawal.description || "Retiro de efectivo",
      amount: withdrawal.amount,
      person: withdrawal.person,
      shift: withdrawal.shift,
    });
  }

  return entries.sort(byNewestFirst);
}

export function buildActivity(
  closings: ClosingRecord[],
  withdrawals: WithdrawalRecord[],
  cancellations: CancellationRecord[],
  limit = 6,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const closing of closings) {
    items.push({
      id: `cierre-${closing.recordId}`,
      at: closing.createdAt,
      kind: "cierre",
      title: "Cierre de turno",
      shift: closing.shift,
      detail: closing.person,
      amount: closingTotal(closing),
      href: `/dashboard/cierres/${closing.recordId}`,
    });
  }

  for (const withdrawal of withdrawals) {
    items.push({
      id: `retiro-${withdrawal.withdrawalId}`,
      at: withdrawal.createdAt,
      kind: "retiro",
      title: "Retiro de efectivo",
      shift: withdrawal.shift,
      detail: withdrawal.description || withdrawal.person,
      amount: -withdrawal.amount,
      href: "/dashboard/movimientos",
    });
  }

  for (const cancellation of cancellations) {
    items.push({
      id: `anulacion-${cancellation.cancellationId}`,
      at: cancellation.createdAt,
      kind: "anulacion",
      title: "Anulación",
      shift: "",
      detail: cancellation.reason || cancellation.targetType,
      amount: null,
      href: null,
    });
  }

  return items.sort(byNewestFirst).slice(0, limit);
}

export function buildAlerts({
  cashBalance,
  config,
  closings,
  cancellations,
}: {
  cashBalance: number;
  config: CashConfig;
  closings: ClosingRecord[];
  cancellations: CancellationRecord[];
}): Alert[] {
  const alerts: Alert[] = [];

  if (cashBalance < 0) {
    alerts.push({
      id: "saldo-negativo",
      severity: "critical",
      title: "Saldo de caja negativo",
      detail: `Los retiros superan el efectivo registrado en ${money(Math.abs(cashBalance))}. Revisa el último corte.`,
      href: "/dashboard/movimientos",
    });
  } else if (cashBalance >= config.cashLimit) {
    alerts.push({
      id: "sobre-limite",
      severity: "warning",
      title: "Caja sobre el límite",
      detail: `Hay ${money(cashBalance)} en caja y el límite recomendado es ${money(config.cashLimit)}.`,
      href: "/dashboard/movimientos",
    });
  }

  if (cancellations.length > 0) {
    alerts.push({
      id: "anulaciones",
      severity: "warning",
      title:
        cancellations.length === 1
          ? "1 anulación en el periodo"
          : `${cancellations.length} anulaciones en el periodo`,
      detail: "Revisa la trazabilidad de los registros anulados.",
      href: null,
    });
  }

  const withNotes = closings.filter((closing) => closing.notes.trim());
  if (withNotes.length > 0) {
    alerts.push({
      id: "observaciones",
      severity: "info",
      title:
        withNotes.length === 1
          ? "1 cierre con observaciones"
          : `${withNotes.length} cierres con observaciones`,
      // Hoy el campo es obligatorio en la app de cierre, asi que practicamente
      // todos los cierres traen texto. Se muestra como dato, no como alarma.
      detail: "Las observaciones son obligatorias al cerrar, así que no distinguen incidencias.",
      href: "/dashboard/cierres",
    });
  }

  return alerts;
}

export function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}Q${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Para espacios estrechos (centro de la dona, ejes): Q12.5K, Q1.2M. */
export function moneyCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${sign}Q${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (abs >= 1_000) {
    return `${sign}Q${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `${sign}Q${Math.round(abs)}`;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function deltaLabel(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  const arrow = change >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(Math.round(change * 100))}%`;
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + (pick(item) || 0), 0);
}

function byNewestFirst(a: { at: string }, b: { at: string }): number {
  return (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0);
}

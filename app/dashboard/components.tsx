"use client";

import type { ReactNode } from "react";

import {
  money,
  moneyCompact,
  percent,
  type MethodSlice,
  type PeriodKey,
} from "@/lib/dashboardMetrics";
import { useDashboard } from "./dashboard-context";

/* ---------- iconografia ---------- */

type IconProps = { size?: number };

function svgProps(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function IconHome({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

export function IconReceipt({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

export function IconSwap({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

export function IconMore({ size = 20 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconArrowLeft({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/* Flechas diagonales de "entra / sale", no arriba-abajo: con arriba-abajo un
   retiro con flecha hacia arriba se lee como si el dinero subiera. */

export function IconIn({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M17 7 7 17M7 10v7h7" />
    </svg>
  );
}

export function IconOut({ size = 16 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M7 17 17 7M10 7h7v7" />
    </svg>
  );
}

export function IconCheck({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

export function IconWarning({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

export function IconCritical({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5M12 16h.01" />
    </svg>
  );
}

export function IconInfo({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function IconLock({ size = 18 }: IconProps) {
  return (
    <svg {...svgProps(size)}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/* ---------- envolturas ---------- */

export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dash-card">
      {title &&
        (action ? (
          <div className="dash-card-head">
            <h2 className="dash-card-title">{title}</h2>
            {action}
          </div>
        ) : (
          <h2 className="dash-card-title">{title}</h2>
        ))}
      {children}
    </section>
  );
}

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="dash-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="dash-sub">{subtitle}</p>}
      </div>
      <span className="dash-brand" aria-label="7-10 Coffee">
        7-10 <small>Coffee</small>
      </span>
    </header>
  );
}

/* ---------- selector de periodo ---------- */

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "custom", label: "Personalizado" },
];

export function PeriodPicker() {
  const { period, setPeriod, customRange, setCustomRange } = useDashboard();

  return (
    <>
      <div className="dash-periods" role="group" aria-label="Periodo">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="dash-chip"
            aria-pressed={period === option.key}
            onClick={() => setPeriod(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="dash-custom-range">
          <label>
            Desde
            <input
              type="date"
              value={customRange.from}
              max={customRange.to || undefined}
              onChange={(event) =>
                setCustomRange({ ...customRange, from: event.target.value })
              }
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={customRange.to}
              min={customRange.from || undefined}
              onChange={(event) =>
                setCustomRange({ ...customRange, to: event.target.value })
              }
            />
          </label>
        </div>
      )}
    </>
  );
}

/* ---------- KPI ---------- */

export function KpiTile({
  label,
  value,
  foot,
  tone = "neutral",
  accent = false,
  swatch,
}: {
  label: string;
  value: string;
  foot?: string | null;
  tone?: "neutral" | "up" | "down";
  accent?: boolean;
  /** Color de la porcion equivalente en la dona, para que se lean como lo mismo. */
  swatch?: string;
}) {
  return (
    <div className="dash-kpi">
      <p className="dash-kpi-label">
        {swatch && (
          <span
            className="dash-swatch"
            style={{ background: swatch }}
            aria-hidden="true"
          />
        )}
        {label}
      </p>
      <strong className={`dash-kpi-value${accent ? " is-accent" : ""}`}>{value}</strong>
      {foot && (
        <p
          className={`dash-kpi-foot${tone === "up" ? " is-up" : ""}${
            tone === "down" ? " is-down" : ""
          }`}
        >
          {foot}
        </p>
      )}
    </div>
  );
}

/**
 * Resumen de entradas/salidas/neto. Va en filas y no en tres columnas porque
 * un monto como Q67,566.00 no cabe en un tercio de pantalla de telefono.
 */
export function SummaryStats({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: "in" | "out" | "net" }>;
}) {
  return (
    <dl className="dash-detail-rows">
      {items.map((item) => (
        <div
          key={item.label}
          className={`dash-detail-row${item.tone === "net" ? " is-total" : ""}`}
        >
          <dt>{item.label}</dt>
          <dd
            style={
              item.tone === "in"
                ? { color: "var(--good-ink)" }
                : item.tone === "out"
                  ? { color: "var(--critical-ink)" }
                  : undefined
            }
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- dona de metodos de pago ---------- */

export function MethodDonut({
  slices,
  total,
}: {
  slices: MethodSlice[];
  total: number;
}) {
  const size = 128;
  const stroke = 17;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = slices.filter((slice) => slice.amount > 0);
  // El separador es aire del color de la superficie, nunca un borde dibujado.
  const gap = visible.length > 1 ? 3 : 0;

  // Cada arco arranca donde termina la suma de los anteriores.
  const arcs = visible.reduce<
    Array<{ slice: MethodSlice; dash: number; offset: number }>
  >((accumulated, slice) => {
    const previous = accumulated.at(-1);
    const offset = previous ? previous.offset + previous.slice.share * circumference : 0;
    const dash = Math.max(slice.share * circumference - gap, 0.6);
    return [...accumulated, { slice, dash, offset }];
  }, []);

  return (
    <svg
      className="dash-donut"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Ventas por método de pago, total ${money(total)}`}
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#eceeed"
          strokeWidth={stroke}
        />
        {arcs.map(({ slice, dash, offset }) => (
          <circle
            key={slice.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
          />
        ))}
      </g>
      <text
        className="dash-donut-center-label"
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
      >
        TOTAL
      </text>
      <text
        className="dash-donut-center"
        x={size / 2}
        y={size / 2 + 9}
        textAnchor="middle"
      >
        {moneyCompact(total)}
      </text>
    </svg>
  );
}

export function MethodLegend({
  slices,
  compact = false,
  showAmounts = true,
}: {
  slices: MethodSlice[];
  compact?: boolean;
  /**
   * En el Resumen los montos ya viven en las tarjetas de arriba, asi que la
   * leyenda se queda solo con la proporcion y no repite el mismo numero dos
   * veces en pantalla. En Reportes la leyenda ES el desglose y si los necesita.
   */
  showAmounts?: boolean;
}) {
  return (
    <ul className="dash-legend">
      {slices.map((slice) => (
        <li key={slice.key}>
          <span className="dash-swatch" style={{ background: slice.color }} />
          <span className="dash-legend-label">
            {compact ? slice.shortLabel : slice.label}
          </span>
          <span className="dash-legend-value">
            {showAmounts ? (
              <>
                {money(slice.amount)}
                <span>{percent(slice.share)}</span>
              </>
            ) : (
              percent(slice.share)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- medidor de efectivo ---------- */

export function CashMeter({
  balance,
  baseCash,
  cashLimit,
}: {
  balance: number;
  baseCash: number;
  cashLimit: number;
}) {
  const ratio = cashLimit > 0 ? balance / cashLimit : 0;
  const width = Math.min(Math.max(ratio, 0), 1) * 100;
  const state = balance < 0 ? "is-critical" : ratio >= 1 ? "is-warning" : "";

  return (
    <>
      <p className="dash-meter-value">{money(balance)}</p>
      <p className="dash-meter-caption">
        {balance < 0
          ? "Saldo negativo: los retiros superan el efectivo registrado."
          : ratio >= 1
            ? "Por encima del límite recomendado."
            : "Dentro del rango operativo."}
      </p>
      <div
        className="dash-meter-track"
        role="meter"
        aria-valuenow={Math.round(balance)}
        aria-valuemin={0}
        aria-valuemax={Math.round(cashLimit)}
        aria-label="Efectivo en caja frente al límite recomendado"
      >
        <div className={`dash-meter-fill ${state}`} style={{ width: `${width}%` }} />
      </div>
      <div className="dash-meter-scale">
        <div>
          <strong>{money(baseCash)}</strong>
          Fondo operativo
        </div>
        <div>
          <strong>{money(cashLimit)}</strong>
          Límite recomendado
        </div>
      </div>
    </>
  );
}

/* ---------- nota de dato faltante ---------- */

export function Unavailable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="dash-unavailable">
      <IconInfo size={16} />
      <div>
        <strong>{title}</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}

/* ---------- estados ---------- */

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="dash-empty">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="dash-error" role="alert">
      <strong>No se pudieron leer los datos</strong>
      <span>{message}</span>
      <button type="button" className="dash-button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando datos</span>
      <div className="dash-kpis">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="dash-kpi">
            <div className="dash-skeleton" style={{ width: "60%", height: 12 }} />
            <div
              className="dash-skeleton"
              style={{ width: "85%", height: 22, marginTop: 10 }}
            />
          </div>
        ))}
      </div>
      {[180, 150, 220].map((height, index) => (
        <div key={index} className="dash-card">
          <div className="dash-skeleton" style={{ width: "45%", height: 14 }} />
          <div
            className="dash-skeleton"
            style={{ width: "100%", height, marginTop: 14 }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- utilidades de presentacion ---------- */

export { shiftClass, shiftLabel } from "@/lib/shifts";

export function initials(name: string) {
  const clean = name.trim();
  if (!clean) return "--";
  return clean.slice(0, 2).toUpperCase();
}

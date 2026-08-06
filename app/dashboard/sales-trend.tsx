"use client";

import { useState } from "react";

import { money, moneyCompact, type DailyPoint } from "@/lib/dashboardMetrics";

const WIDTH = 320;
const HEIGHT = 150;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

const ACCENT = "#0d7a45";

function niceMax(value: number) {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function SalesTrend({ points }: { points: DailyPoint[] }) {
  // Se guarda el dia, no la posicion: al cambiar de rango la clave anterior
  // deja de existir y el punto activo vuelve solo al ultimo de la serie.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (points.length === 0) {
    return null;
  }

  const max = niceMax(Math.max(...points.map((point) => point.total)));
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const x = (index: number) =>
    points.length > 1 ? PAD_LEFT + index * step : PAD_LEFT + plotWidth / 2;
  const y = (value: number) => PAD_TOP + plotHeight - (value / max) * plotHeight;

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)} ${y(point.total)}`)
    .join(" ");

  const ticks = [0, max / 2, max];
  // Con muchos dias un punto por fecha se vuelve ruido; se marca el extremo.
  const showAllMarkers = points.length <= 10;
  const foundIndex = points.findIndex((point) => point.dayKey === activeKey);
  // Sin seleccion, la lectura util es el ultimo dia con ventas, no un cero final.
  const lastWithSales = points.reduce(
    (best, point, index) => (point.total > 0 ? index : best),
    points.length - 1,
  );
  const safeIndex = foundIndex >= 0 ? foundIndex : lastWithSales;
  const active = points[safeIndex];

  const xLabelIndexes =
    points.length <= 3
      ? points.map((_, index) => index)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div>
      <svg
        className="dash-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Ventas por día, máximo ${money(max)}`}
        onMouseLeave={() => setActiveKey(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="dash-grid-line"
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="dash-axis-label"
              x={PAD_LEFT - 6}
              y={y(tick) + 3}
              textAnchor="end"
            >
              {moneyCompact(tick)}
            </text>
          </g>
        ))}

        <path
          d={path}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => {
          const isActive = index === safeIndex;
          const isEdge = index === points.length - 1;

          if (!showAllMarkers && !isActive && !isEdge) {
            return null;
          }

          return (
            <circle
              key={point.dayKey}
              cx={x(index)}
              cy={y(point.total)}
              r={isActive ? 5 : 4}
              fill={ACCENT}
              stroke="#ffffff"
              strokeWidth={2}
            />
          );
        })}

        {xLabelIndexes.map((index) => (
          <text
            key={points[index].dayKey}
            className="dash-axis-label"
            x={x(index)}
            y={HEIGHT - 6}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
          >
            {points[index].label}
          </text>
        ))}

        {points.map((point, index) => (
          <rect
            key={`hit-${point.dayKey}`}
            className="dash-chart-hit"
            x={x(index) - Math.max(step / 2, 10)}
            y={0}
            width={Math.max(step, 20)}
            height={HEIGHT}
            onMouseEnter={() => setActiveKey(point.dayKey)}
            onClick={() => setActiveKey(point.dayKey)}
          >
            <title>{`${point.label}: ${money(point.total)}`}</title>
          </rect>
        ))}
      </svg>

      <p className="dash-tooltip" aria-live="polite">
        <span className="dash-tooltip-day">{active.label}</span>
        <br />
        <strong>{money(active.total)}</strong>
      </p>
    </div>
  );
}

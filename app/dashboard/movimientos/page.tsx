"use client";

import { useMemo, useState } from "react";

import {
  buildMovements,
  closingsInRange,
  formatDayKey,
  dayKey,
  formatTime,
  money,
  withdrawalsInRange,
} from "@/lib/dashboardMetrics";
import {
  Card,
  EmptyState,
  ErrorState,
  IconIn,
  IconOut,
  LoadingScreen,
  PeriodPicker,
  ScreenHeader,
  SummaryStats,
  shiftLabel,
} from "../components";
import { useDashboard } from "../dashboard-context";

type Filter = "todos" | "in" | "out";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "in", label: "Entradas" },
  { key: "out", label: "Salidas" },
];

export default function MovimientosPage() {
  const { status, error, snapshot, reload, range } = useDashboard();
  const [filter, setFilter] = useState<Filter>("todos");

  const movements = useMemo(() => {
    if (!snapshot) return [];

    return buildMovements(
      closingsInRange(snapshot.closings, range),
      withdrawalsInRange(snapshot.withdrawals, range),
    );
  }, [snapshot, range]);

  const totals = useMemo(() => {
    const incoming = movements
      .filter((movement) => movement.direction === "in")
      .reduce((total, movement) => total + movement.amount, 0);
    const outgoing = movements
      .filter((movement) => movement.direction === "out")
      .reduce((total, movement) => total + movement.amount, 0);

    return { incoming, outgoing, net: incoming - outgoing };
  }, [movements]);

  const visible = movements.filter(
    (movement) => filter === "todos" || movement.direction === filter,
  );

  // Los movimientos se agrupan por dia para que un rango largo siga leyendose.
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();

    for (const movement of visible) {
      const key = dayKey(movement.at);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(movement);
      } else {
        map.set(key, [movement]);
      }
    }

    return Array.from(map.entries());
  }, [visible]);

  return (
    <main className="dash-wrap">
      <ScreenHeader title="Movimientos" subtitle={range.label} />
      <PeriodPicker />

      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "loading" && <LoadingScreen />}

      {status === "ready" && (
        <>
          <Card title="Flujo de efectivo del periodo">
            <SummaryStats
              items={[
                { label: "Entradas", value: money(totals.incoming), tone: "in" },
                { label: "Salidas", value: money(totals.outgoing), tone: "out" },
                { label: "Neto", value: money(totals.net), tone: "net" },
              ]}
            />
          </Card>

          <div className="dash-periods" role="group" aria-label="Filtrar movimientos">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                className="dash-chip"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {groups.length > 0 ? (
            groups.map(([day, items]) => (
              <Card key={day} title={formatDayKey(day)}>
                <ul className="dash-list">
                  {items.map((movement) => (
                    <li key={movement.id}>
                      <div className="dash-row">
                        <span
                          className={`dash-row-icon${
                            movement.direction === "out" ? " is-out" : ""
                          }`}
                        >
                          {movement.direction === "out" ? <IconOut /> : <IconIn />}
                        </span>
                        <span className="dash-row-body">
                          <span className="dash-row-title">
                            {movement.type} · {movement.concept}
                          </span>
                          <span className="dash-row-meta">
                            {formatTime(movement.at)} · {movement.person || "Sin responsable"}
                            {movement.shift ? ` · ${shiftLabel(movement.shift)}` : ""}
                          </span>
                        </span>
                        <span
                          className={`dash-row-amount ${
                            movement.direction === "out" ? "is-out" : "is-in"
                          }`}
                        >
                          {movement.direction === "out" ? "−" : "+"}
                          {money(movement.amount)}
                          <span>Efectivo</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                title="Sin movimientos"
                detail="No hay entradas ni salidas de efectivo en el periodo seleccionado."
              />
            </Card>
          )}
        </>
      )}
    </main>
  );
}

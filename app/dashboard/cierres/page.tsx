"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  CASH_STATUS_LABELS,
  cashStatus,
  closingDifference,
  closingTotal,
  closingsInRange,
  formatTime,
  money,
} from "@/lib/dashboardMetrics";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingScreen,
  PeriodPicker,
  ScreenHeader,
  initials,
  shiftClass,
  shiftLabel,
} from "../components";
import { useDashboard } from "../dashboard-context";

export default function CierresPage() {
  const { status, error, snapshot, reload, range } = useDashboard();
  const [shiftFilter, setShiftFilter] = useState("todos");

  const closings = useMemo(() => {
    if (!snapshot) return [];

    return closingsInRange(snapshot.closings, range).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }, [snapshot, range]);

  const shifts = useMemo(() => {
    const unique = new Set(
      closings.map((closing) => closing.shift.trim()).filter(Boolean),
    );
    return ["todos", ...Array.from(unique)];
  }, [closings]);

  const visible = closings.filter(
    (closing) => shiftFilter === "todos" || closing.shift.trim() === shiftFilter,
  );

  return (
    <main className="dash-wrap">
      <ScreenHeader title="Cierres" subtitle={range.label} />
      <PeriodPicker />

      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "loading" && <LoadingScreen />}

      {status === "ready" && (
        <>
          {shifts.length > 2 && (
            <div className="dash-periods" role="group" aria-label="Filtrar por turno">
              {shifts.map((shift) => (
                <button
                  key={shift}
                  type="button"
                  className="dash-chip"
                  aria-pressed={shiftFilter === shift}
                  onClick={() => setShiftFilter(shift)}
                >
                  {shift === "todos" ? "Todos" : shiftLabel(shift)}
                </button>
              ))}
            </div>
          )}

          {visible.length > 0 ? (
            <>
              {visible.map((closing) => (
                <Link
                  key={closing.recordId}
                  className="dash-closing"
                  href={`/dashboard/cierres/${closing.recordId}`}
                >
                  <div className="dash-closing-top">
                    <div className="dash-closing-who">
                      <span className="dash-avatar" aria-hidden="true">
                        {initials(closing.person)}
                      </span>
                      <span>
                        <span className="dash-closing-name">
                          {closing.person || "Sin responsable"}
                        </span>
                        <span className="dash-closing-time">
                          {formatTime(closing.createdAt)}
                        </span>
                      </span>
                    </div>
                    <span className={`dash-tag ${shiftClass(closing.shift)}`}>
                      {closing.shift ? shiftLabel(closing.shift) : "Sin turno"}
                    </span>
                  </div>

                  <div className="dash-figures">
                    <div className="dash-figure">
                      <span>Total ventas</span>
                      <strong>{money(closingTotal(closing))}</strong>
                    </div>
                    <div className="dash-figure">
                      <span>Efectivo</span>
                      <strong>{money(closing.cashSales)}</strong>
                    </div>
                    <div className="dash-figure">
                      <span>Saldo anterior</span>
                      <strong>{money(closing.previousCash)}</strong>
                    </div>
                    <div className="dash-figure">
                      <span>Caja esperada</span>
                      <strong>{money(closing.expectedCash)}</strong>
                    </div>
                    <div className="dash-figure">
                      <span>Caja contada</span>
                      <strong>{money(closing.countedCash)}</strong>
                    </div>
                    <div
                      className={`dash-figure is-${cashStatus(closingDifference(closing))}`}
                    >
                      <span>{CASH_STATUS_LABELS[cashStatus(closingDifference(closing))]}</span>
                      <strong>
                        {closingDifference(closing) > 0 ? "+" : ""}
                        {money(closingDifference(closing))}
                      </strong>
                    </div>
                  </div>
                </Link>
              ))}

            </>
          ) : (
            <Card>
              <EmptyState
                title="Sin cierres"
                detail="No hay cierres registrados con el periodo y el turno seleccionados."
              />
            </Card>
          )}
        </>
      )}
    </main>
  );
}

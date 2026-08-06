"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  buildDailySeries,
  buildSales,
  closingsInRange,
  deltaLabel,
  formatLongDate,
  money,
  previousRange,
  withdrawalsInRange,
} from "@/lib/dashboardMetrics";
import {
  Card,
  EmptyState,
  ErrorState,
  KpiTile,
  LoadingScreen,
  MethodLegend,
  PeriodPicker,
  ScreenHeader,
  Unavailable,
} from "../components";
import { useDashboard } from "../dashboard-context";
import { SalesTrend } from "../sales-trend";

export default function ReportesPage() {
  const router = useRouter();
  const { status, error, snapshot, reload, range } = useDashboard();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const view = useMemo(() => {
    if (!snapshot) return null;

    const closings = closingsInRange(snapshot.closings, range);
    const withdrawals = withdrawalsInRange(snapshot.withdrawals, range);
    const sales = buildSales(closings);
    const previous = buildSales(closingsInRange(snapshot.closings, previousRange(range)));

    return {
      sales,
      previousTotal: previous.total,
      closingsCount: closings.length,
      series: buildDailySeries(closings, range),
      withdrawalsTotal: withdrawals.reduce((total, item) => total + item.amount, 0),
      withdrawalsCount: withdrawals.length,
    };
  }, [snapshot, range]);

  async function signOut() {
    setIsSigningOut(true);
    await fetch("/api/dashboard/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <main className="dash-wrap">
      <ScreenHeader title="Reportes" subtitle={range.label} />
      <PeriodPicker />

      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "loading" && <LoadingScreen />}

      {status === "ready" && view && snapshot && (
        <>
          <div className="dash-kpis" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <KpiTile
              label="Ventas del periodo"
              value={money(view.sales.total)}
              accent
              foot={
                deltaLabel(view.sales.total, view.previousTotal)
                  ? `${deltaLabel(view.sales.total, view.previousTotal)} vs. periodo anterior`
                  : undefined
              }
              tone={
                view.previousTotal > 0
                  ? view.sales.total >= view.previousTotal
                    ? "up"
                    : "down"
                  : "neutral"
              }
            />
            <KpiTile
              label="Cierres"
              value={String(view.closingsCount)}
              foot="Registros en el periodo"
            />
          </div>

          <Card title="Ventas por día">
            {view.sales.total > 0 ? (
              <SalesTrend points={view.series} />
            ) : (
              <EmptyState
                title="Sin ventas en el periodo"
                detail="Selecciona otro rango para ver la tendencia."
              />
            )}
          </Card>

          <Card title="Desglose por método de pago">
            {view.sales.total > 0 ? (
              <MethodLegend slices={view.sales.methods} />
            ) : (
              <EmptyState
                title="Sin datos"
                detail="No hay ventas registradas en el periodo."
              />
            )}
          </Card>

          <Card title="Retiros del periodo">
            <dl className="dash-detail-rows">
              <div className="dash-detail-row">
                <dt>Total retirado</dt>
                <dd>{money(view.withdrawalsTotal)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Número de retiros</dt>
                <dd>{view.withdrawalsCount}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Retiro estándar configurado</dt>
                <dd>{money(snapshot.config.standardWithdrawal)}</dd>
              </div>
            </dl>

            <Unavailable title="Diferencias de caja: dato no disponible">
              No se puede reportar cuántos cierres tuvieron diferencia porque el
              conteo físico de efectivo no se registra. Requerimiento futuro.
            </Unavailable>
          </Card>

          <Card title="Configuración de caja">
            <dl className="dash-detail-rows">
              <div className="dash-detail-row">
                <dt>Fondo operativo</dt>
                <dd>{money(snapshot.config.baseCash)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Límite de caja</dt>
                <dd>{money(snapshot.config.cashLimit)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Retiro estándar</dt>
                <dd>{money(snapshot.config.standardWithdrawal)}</dd>
              </div>
            </dl>
            <Unavailable title="Solo lectura">
              Estos valores se editan en la hoja <code>estado_caja</code>. El
              dashboard nunca los modifica.
            </Unavailable>
          </Card>

          <Card title="Acerca de">
            <dl className="dash-detail-rows">
              <div className="dash-detail-row">
                <dt>Origen de datos</dt>
                <dd>{snapshot.mode === "sheets" ? "Google Sheets" : "Local"}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Último cierre</dt>
                <dd>
                  {snapshot.lastClosingAt
                    ? formatLongDate(snapshot.lastClosingAt)
                    : "Sin registros"}
                </dd>
              </div>
              <div className="dash-detail-row">
                <dt>Datos actualizados</dt>
                <dd>{formatLongDate(snapshot.generatedAt)}</dd>
              </div>
            </dl>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="dash-button is-ghost" onClick={reload}>
                Actualizar datos
              </button>
              <button
                type="button"
                className="dash-button is-ghost"
                onClick={signOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Saliendo" : "Cerrar sesión"}
              </button>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}

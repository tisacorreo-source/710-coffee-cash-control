"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  buildActivity,
  buildAlerts,
  buildSales,
  cancellationsInRange,
  closingsInRange,
  deltaLabel,
  formatTime,
  money,
  previousRange,
  withdrawalsInRange,
  type Alert,
} from "@/lib/dashboardMetrics";
import {
  Card,
  CashMeter,
  EmptyState,
  ErrorState,
  IconCheck,
  IconCritical,
  IconIn,
  IconInfo,
  IconOut,
  IconWarning,
  KpiTile,
  LoadingScreen,
  MethodDonut,
  MethodLegend,
  PeriodPicker,
  ScreenHeader,
  Unavailable,
  shiftLabel,
} from "./components";
import { useDashboard } from "./dashboard-context";

function AlertIcon({ severity }: { severity: Alert["severity"] }) {
  if (severity === "critical") return <IconCritical size={18} />;
  if (severity === "warning") return <IconWarning size={18} />;
  return <IconInfo size={18} />;
}

function AlertBody({ alert }: { alert: Alert }) {
  return (
    <>
      <span className="dash-alert-icon">
        <AlertIcon severity={alert.severity} />
      </span>
      <span>
        <span className="dash-alert-title">{alert.title}</span>
        <span className="dash-alert-detail">{alert.detail}</span>
      </span>
    </>
  );
}

export default function ResumenPage() {
  const { status, error, snapshot, reload, range } = useDashboard();

  const view = useMemo(() => {
    if (!snapshot) return null;

    const closings = closingsInRange(snapshot.closings, range);
    const withdrawals = withdrawalsInRange(snapshot.withdrawals, range);
    const cancellations = cancellationsInRange(snapshot.cancellations, range);

    const sales = buildSales(closings);
    const previous = buildSales(closingsInRange(snapshot.closings, previousRange(range)));

    return {
      closings,
      withdrawals,
      sales,
      previousTotal: previous.total,
      withdrawalsTotal: withdrawals.reduce((total, item) => total + item.amount, 0),
      activity: buildActivity(closings, withdrawals, cancellations),
      alerts: buildAlerts({
        cashBalance: snapshot.cashBalance,
        config: snapshot.config,
        closings,
        cancellations,
      }),
    };
  }, [snapshot, range]);

  return (
    <main className="dash-wrap">
      <ScreenHeader title="Resumen" subtitle={range.label} />
      <PeriodPicker />

      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "loading" && <LoadingScreen />}

      {status === "ready" && view && snapshot && (
        <>
          <div className="dash-kpis">
            <KpiTile
              label="Ventas"
              value={money(view.sales.total)}
              accent
              foot={
                deltaLabel(view.sales.total, view.previousTotal)
                  ? `${deltaLabel(view.sales.total, view.previousTotal)} vs. periodo anterior`
                  : `${view.closings.length} ${view.closings.length === 1 ? "cierre" : "cierres"}`
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
              label="Efectivo"
              value={money(view.sales.cash)}
              foot="Ventas cobradas en efectivo"
            />
            <KpiTile
              label="No efectivo"
              value={money(view.sales.nonCash)}
              foot="Tarjeta, transferencias y Uber Eats"
            />
            <KpiTile
              label="Retirado"
              value={money(view.withdrawalsTotal)}
              foot={`${view.withdrawals.length} ${
                view.withdrawals.length === 1 ? "retiro" : "retiros"
              } en el periodo`}
            />
          </div>

          <div className="dash-cols">
            <Card title="Ventas por método de pago">
              {view.sales.total > 0 ? (
                <div className="dash-donut-row">
                  <MethodDonut slices={view.sales.methods} total={view.sales.total} />
                  <MethodLegend slices={view.sales.methods} compact />
                </div>
              ) : (
                <EmptyState
                  title="Sin ventas en el periodo"
                  detail="No hay cierres registrados en las fechas seleccionadas."
                />
              )}
            </Card>

            <Card title="Control de efectivo">
              <CashMeter
                balance={snapshot.cashBalance}
                baseCash={snapshot.config.baseCash}
                cashLimit={snapshot.config.cashLimit}
              />
              <Unavailable title="Estado de caja: dato no disponible">
                La app de cierre no registra hoy el efectivo contado físicamente, así
                que no se puede calcular si la caja está cuadrada, sobra o falta
                dinero. Requerimiento futuro.
              </Unavailable>
            </Card>
          </div>

          <Card title="Requiere atención">
            {view.alerts.length > 0 ? (
              <div>
                {view.alerts.map((alert) =>
                  alert.href ? (
                    <Link
                      key={alert.id}
                      href={alert.href}
                      className={`dash-alert is-${alert.severity}`}
                    >
                      <AlertBody alert={alert} />
                    </Link>
                  ) : (
                    <div key={alert.id} className={`dash-alert is-${alert.severity}`}>
                      <AlertBody alert={alert} />
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="dash-ok">
                <IconCheck />
                <strong>Todo en orden.</strong> Sin incidencias en el periodo.
              </p>
            )}
          </Card>

          <Card
            title="Actividad reciente"
            action={
              <Link className="dash-link" href="/dashboard/movimientos">
                Ver todo
              </Link>
            }
          >
            {view.activity.length > 0 ? (
              <ul className="dash-list">
                {view.activity.map((item) => {
                  const body = (
                    <>
                      <span
                        className={`dash-row-icon${
                          item.kind === "retiro"
                            ? " is-out"
                            : item.kind === "anulacion"
                              ? " is-flag"
                              : ""
                        }`}
                      >
                        {item.kind === "retiro" ? (
                          <IconOut size={16} />
                        ) : item.kind === "anulacion" ? (
                          <IconInfo size={16} />
                        ) : (
                          <IconIn size={16} />
                        )}
                      </span>
                      <span className="dash-row-body">
                        <span className="dash-row-title">
                          {item.title}
                          {item.shift ? ` · ${shiftLabel(item.shift)}` : ""}
                        </span>
                        <span className="dash-row-meta">
                          {formatTime(item.at)} · {item.detail || "Sin detalle"}
                        </span>
                      </span>
                      <span
                        className={`dash-row-amount${
                          item.amount === null
                            ? ""
                            : item.amount < 0
                              ? " is-out"
                              : " is-in"
                        }`}
                      >
                        {item.amount === null ? "—" : money(item.amount)}
                      </span>
                    </>
                  );

                  return (
                    <li key={item.id}>
                      {item.href ? (
                        <Link className="dash-row" href={item.href}>
                          {body}
                        </Link>
                      ) : (
                        <div className="dash-row">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Sin actividad"
                detail="No hay cierres, retiros ni anulaciones en el periodo seleccionado."
              />
            )}
          </Card>
        </>
      )}
    </main>
  );
}

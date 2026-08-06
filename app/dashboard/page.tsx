"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  buildActivity,
  buildAlerts,
  buildSales,
  CASH_STATUS_LABELS,
  cancellationsInRange,
  cashStatus,
  closingDifference,
  closingsInRange,
  deltaLabel,
  formatTime,
  money,
  percent,
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
      difference: closings.reduce(
        (total, closing) => total + closingDifference(closing),
        0,
      ),
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
            {/* Una tarjeta por medio de pago, en el mismo orden y con el mismo
                color que la dona de abajo. Se recorre sales.methods en vez de
                leer cash/card/transfer/uber sueltos para que tarjetas y grafica
                no se puedan desincronizar. */}
            {view.sales.methods.map((method) => (
              <KpiTile
                key={method.key}
                label={method.shortLabel}
                value={money(method.amount)}
                swatch={method.color}
                foot={
                  view.sales.total > 0
                    ? `${percent(method.share)} del total`
                    : "Sin ventas en el periodo"
                }
              />
            ))}
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
                  <MethodLegend slices={view.sales.methods} compact showAmounts={false} />
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
              <div className={`dash-status is-${cashStatus(view.difference)}`}>
                {view.difference === 0 ? (
                  <IconCheck size={18} />
                ) : (
                  <IconWarning size={18} />
                )}
                <span>
                  <strong>{CASH_STATUS_LABELS[cashStatus(view.difference)]}</strong>
                  <small>
                    {view.difference === 0
                      ? "Lo contado coincide con lo esperado en el periodo."
                      : `Diferencia acumulada del periodo: ${money(view.difference)}.`}
                  </small>
                </span>
              </div>
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

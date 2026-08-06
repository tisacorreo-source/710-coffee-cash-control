"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import {
  CASH_STATUS_LABELS,
  METHOD_COLORS,
  cashStatus,
  closingDifference,
  closingTotal,
  formatLongDate,
  formatTime,
  money,
} from "@/lib/dashboardMetrics";
import {
  Card,
  EmptyState,
  ErrorState,
  IconArrowLeft,
  LoadingScreen,
  ScreenHeader,
  initials,
  shiftClass,
  shiftLabel,
} from "../../components";
import { useDashboard } from "../../dashboard-context";

const DENOMINATION_LABELS: Record<string, string> = {
  q200: "Q200",
  q100: "Q100",
  q50: "Q50",
  q20: "Q20",
  q10: "Q10",
  q5: "Q5",
  q1: "Q1",
  menores: "Monedas menores",
};

const DENOMINATION_VALUES: Record<string, number> = {
  q200: 200,
  q100: 100,
  q50: 50,
  q20: 20,
  q10: 10,
  q5: 5,
  q1: 1,
};

export default function DetalleCierrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { status, error, snapshot, reload } = useDashboard();

  const closing = useMemo(
    () => snapshot?.closings.find((item) => item.recordId === id) || null,
    [snapshot, id],
  );

  const denominations = useMemo(() => {
    if (!closing) return [];

    return Object.entries(closing.denominations)
      .filter(([, count]) => Number(count) > 0)
      .map(([key, count]) => ({
        key,
        label: DENOMINATION_LABELS[key] || key,
        count: Number(count),
        subtotal: (DENOMINATION_VALUES[key] || 0) * Number(count),
      }));
  }, [closing]);

  return (
    <main className="dash-wrap">
      <Link className="dash-back" href="/dashboard/cierres">
        <IconArrowLeft />
        Cierres
      </Link>

      <ScreenHeader
        title="Detalle del cierre"
        subtitle={closing ? formatLongDate(closing.createdAt) : undefined}
      />

      {status === "error" && <ErrorState message={error} onRetry={reload} />}
      {status === "loading" && <LoadingScreen />}

      {status === "ready" && !closing && (
        <Card>
          <EmptyState
            title="Cierre no encontrado"
            detail="Puede que el registro se haya eliminado de la hoja o que el enlace ya no sea válido."
          />
        </Card>
      )}

      {status === "ready" && closing && (
        <>
          <Card>
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
          </Card>

          <Card title="Ventas">
            <dl className="dash-detail-rows">
              <div className="dash-detail-row">
                <dt>
                  <span
                    className="dash-swatch"
                    style={{ background: METHOD_COLORS.efectivo }}
                  />
                  Ventas en efectivo
                </dt>
                <dd>{money(closing.cashSales)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>
                  <span
                    className="dash-swatch"
                    style={{ background: METHOD_COLORS.tarjeta }}
                  />
                  Ventas con tarjeta
                </dt>
                <dd>{money(closing.cardSales)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>
                  <span
                    className="dash-swatch"
                    style={{ background: METHOD_COLORS.transferencias }}
                  />
                  Transferencias / Otros
                </dt>
                <dd>{money(closing.transferSales)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>
                  <span
                    className="dash-swatch"
                    style={{ background: METHOD_COLORS.uber }}
                  />
                  Uber Eats
                </dt>
                <dd>{money(closing.uberSales)}</dd>
              </div>
              <div className="dash-detail-row is-total">
                <dt>Total ventas</dt>
                <dd>{money(closingTotal(closing))}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Caja">
            <dl className="dash-detail-rows">
              <div className="dash-detail-row">
                <dt>Saldo anterior</dt>
                <dd>{money(closing.previousCash)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Caja esperada</dt>
                <dd>{money(closing.expectedCash)}</dd>
              </div>
              <div className="dash-detail-row">
                <dt>Caja contada</dt>
                <dd>{money(closing.countedCash)}</dd>
              </div>
              <div
                className={`dash-detail-row is-total is-${cashStatus(closingDifference(closing))}`}
              >
                <dt>{CASH_STATUS_LABELS[cashStatus(closingDifference(closing))]}</dt>
                <dd>
                  {closingDifference(closing) > 0 ? "+" : ""}
                  {money(closingDifference(closing))}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Denominaciones del efectivo contado">
            {denominations.length > 0 ? (
              <dl className="dash-detail-rows">
                {denominations.map((item) => (
                  <div key={item.key} className="dash-detail-row">
                    <dt>
                      {item.label} × {item.count}
                    </dt>
                    <dd>{money(item.subtotal)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <EmptyState
                title="Sin denominaciones registradas"
                detail="Este cierre no guardó desglose de billetes y monedas."
              />
            )}
          </Card>

          <Card title="Observaciones">
            <p className="dash-note">
              {closing.notes.trim() || "Sin observaciones."}
            </p>
          </Card>
        </>
      )}
    </main>
  );
}

import type { Metadata } from "next";

import { dashboardGate, hasDashboardSession } from "@/lib/dashboardAuth";
import { DashboardProvider } from "./dashboard-context";
import { DashboardNav } from "./nav";
import { PinGate } from "./pin-gate";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "7-10 Coffee - Dashboard",
  description: "Dashboard de consulta de ventas y control de efectivo.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = dashboardGate();

  if (gate === "misconfigured") {
    return (
      <div className="dash">
        <div className="dash-gate">
          <div className="dash-gate-card">
            <h1>Dashboard no disponible</h1>
            <p>
              Falta configurar la variable <code>DASHBOARD_PIN</code>. Por
              seguridad el dashboard no se abre sin PIN en producción.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (gate === "needs-pin" && !(await hasDashboardSession())) {
    return (
      <div className="dash">
        <PinGate />
      </div>
    );
  }

  return (
    <div className="dash">
      <DashboardProvider>{children}</DashboardProvider>
      <DashboardNav />
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import type { DashboardSnapshot } from "@/lib/googleWorkspace";
import { resolveRange, type DateRange, type PeriodKey } from "@/lib/dashboardMetrics";

type Status = "loading" | "ready" | "error";

type CustomRange = { from: string; to: string };

type DashboardContextValue = {
  status: Status;
  error: string;
  snapshot: DashboardSnapshot | null;
  reload: () => void;
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
  customRange: CustomRange;
  setCustomRange: (range: CustomRange) => void;
  range: DateRange;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("hoy");
  const [customRange, setCustomRange] = useState<CustomRange>({ from: "", to: "" });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setStatus("loading");
      setError("");

      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });

        if (response.status === 401) {
          // La sesion expiro: recargar deja que el layout vuelva a pedir el PIN.
          window.location.reload();
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "No se pudieron leer los datos.");
        }

        if (isActive) {
          setSnapshot(result as DashboardSnapshot);
          setStatus("ready");
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron leer los datos.",
          );
          setStatus("error");
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, [reloadToken]);

  // Un rango personalizado a medio llenar no debe vaciar la pantalla.
  const effectivePeriod: PeriodKey =
    period === "custom" && !(customRange.from && customRange.to) ? "hoy" : period;

  const range = useMemo(
    () => resolveRange(effectivePeriod, customRange),
    [effectivePeriod, customRange],
  );

  const value = useMemo<DashboardContextValue>(
    () => ({
      status,
      error,
      snapshot,
      reload,
      period,
      setPeriod,
      customRange,
      setCustomRange,
      range,
    }),
    [status, error, snapshot, reload, period, customRange, range],
  );

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);

  if (!context) {
    throw new Error("useDashboard debe usarse dentro de DashboardProvider.");
  }

  return context;
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SHIFTS, shiftLabel, type Shift } from "@/lib/shifts";

type View = "cierre" | "retiro";
type Person = "Veronica" | "Rodrigo" | "David" | "Chisco";
type SelectValue<T extends string> = T | "";
type NumberValue = number | "";

type DenominationKey =
  | "q200"
  | "q100"
  | "q50"
  | "q20"
  | "q10"
  | "q5"
  | "q1"
  | "menores";

type CashCounts = Record<DenominationKey, NumberValue>;

type CashState = {
  baseCash: number;
  cashLimit: number;
  currentBalance: number;
  lastClosingAt: string | null;
  lastClosingId: string | null;
  mode: "local" | "sheets";
  persisted: boolean;
  standardWithdrawal: number;
  withdrawalsSinceLastClosing: number;
};

const people: Person[] = ["Veronica", "Rodrigo", "David", "Chisco"];
// Solo manana y tarde: el negocio no tiene turno de noche. Ver lib/shifts.ts.
const shifts: readonly Shift[] = SHIFTS;
const SUCCESS_MESSAGE_DURATION_MS = 2200;

const defaultCashState: CashState = {
  baseCash: 1000,
  cashLimit: 4000,
  currentBalance: 1000,
  lastClosingAt: null,
  lastClosingId: null,
  mode: "local",
  persisted: false,
  standardWithdrawal: 3000,
  withdrawalsSinceLastClosing: 0,
};

// Denominaciones del quetzal. "menores" se captura como monto suelto porque
// contar moneda por moneda al cierre no es realista.
const denominations: Array<{
  key: DenominationKey;
  label: string;
  value: number;
  mode: "count" | "amount";
}> = [
  { key: "q200", label: "Billetes Q200", value: 200, mode: "count" },
  { key: "q100", label: "Billetes Q100", value: 100, mode: "count" },
  { key: "q50", label: "Billetes Q50", value: 50, mode: "count" },
  { key: "q20", label: "Billetes Q20", value: 20, mode: "count" },
  { key: "q10", label: "Billetes Q10", value: 10, mode: "count" },
  { key: "q5", label: "Billetes Q5", value: 5, mode: "count" },
  { key: "q1", label: "Monedas Q1", value: 1, mode: "count" },
  { key: "menores", label: "Monedas menores", value: 1, mode: "amount" },
];

function emptyCounts(): CashCounts {
  return { q200: 0, q100: 0, q50: 0, q20: 0, q10: 0, q5: 0, q1: 0, menores: 0 };
}

function numeric(value: NumberValue) {
  return Number(value) || 0;
}

function hasNumber(value: NumberValue) {
  return value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

/** Suma el efectivo contado a partir del desglose de billetes y monedas. */
function cashTotal(counts: CashCounts) {
  return denominations.reduce((total, denomination) => {
    const rawValue = numeric(counts[denomination.key]);
    return (
      total +
      (denomination.mode === "amount" ? rawValue : rawValue * denomination.value)
    );
  }, 0);
}

function normalizedCounts(counts: CashCounts): Record<DenominationKey, number> {
  return denominations.reduce(
    (totals, denomination) => ({
      ...totals,
      [denomination.key]: numeric(counts[denomination.key]),
    }),
    {} as Record<DenominationKey, number>,
  );
}

function money(value: number) {
  // El signo va antes del simbolo: "-Q50.00", no "Q-50.00".
  const sign = value < 0 ? "-" : "";
  return `${sign}Q${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  labelFor,
}: {
  label: string;
  value: SelectValue<T>;
  options: readonly T[];
  onChange: (value: SelectValue<T>) => void;
  placeholder?: string;
  /** Texto a mostrar cuando difiere del valor que se guarda en Sheets. */
  labelFor?: (option: T) => string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        required
        value={value}
        onChange={(event) => onChange(event.target.value as SelectValue<T>)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelFor ? labelFor(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: NumberValue;
  onChange: (value: NumberValue) => void;
  min?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        min={min}
        required
        step="0.01"
        type="number"
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "" ? "" : Math.max(min, Number(nextValue) || 0));
        }}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <input
        required
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <textarea
        required
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DenominationCounter({
  counts,
  onChange,
}: {
  counts: CashCounts;
  onChange: (counts: CashCounts) => void;
}) {
  function setValue(key: DenominationKey, value: NumberValue) {
    onChange({ ...counts, [key]: value === "" ? "" : Math.max(0, value) });
  }

  return (
    <div className="denomination-grid">
      {denominations.map((denomination) => {
        const value = counts[denomination.key];
        const numericValue = numeric(value);
        const subtotal =
          denomination.mode === "amount"
            ? numericValue
            : numericValue * denomination.value;

        return (
          <div className="denomination-row" key={denomination.key}>
            <div className="denomination-label">
              <strong>{denomination.label}</strong>
              <span>
                {denomination.mode === "amount"
                  ? "Total en Q"
                  : `${money(denomination.value)} c/u`}
              </span>
            </div>
            <div className="stepper">
              <button
                aria-label={`Bajar ${denomination.label}`}
                type="button"
                onClick={() => setValue(denomination.key, numericValue - 1)}
              >
                -
              </button>
              <input
                min={0}
                required
                step={denomination.mode === "amount" ? "0.01" : "1"}
                type="number"
                value={value}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setValue(
                    denomination.key,
                    nextValue === "" ? "" : Number(nextValue) || 0,
                  );
                }}
              />
              <button
                aria-label={`Subir ${denomination.label}`}
                type="button"
                onClick={() => setValue(denomination.key, numericValue + 1)}
              >
                +
              </button>
            </div>
            <strong className="row-total">{money(subtotal)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TotalBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="total-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`tab-button ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("cierre");
  const [statusMessage, setStatusMessage] = useState("");
  const statusTimerRef = useRef<number | null>(null);
  const [cashState, setCashState] = useState<CashState>(defaultCashState);
  const [closingPerson, setClosingPerson] = useState<SelectValue<Person>>("");
  const [closingShift, setClosingShift] = useState<SelectValue<Shift>>("");
  const [cashSales, setCashSales] = useState<NumberValue>("");
  const [cardSales, setCardSales] = useState<NumberValue>("");
  const [transferSales, setTransferSales] = useState<NumberValue>("");
  const [uberSales, setUberSales] = useState<NumberValue>("");
  const [closingCounts, setClosingCounts] = useState<CashCounts>(emptyCounts);
  const [closingNotes, setClosingNotes] = useState("");
  const [withdrawalPerson, setWithdrawalPerson] =
    useState<SelectValue<Person>>("");
  const [withdrawalShift, setWithdrawalShift] = useState<SelectValue<Shift>>("");
  const [withdrawalAmount, setWithdrawalAmount] = useState<NumberValue>("");
  const [withdrawalDescription, setWithdrawalDescription] = useState("");
  const [isSubmittingClosing, setIsSubmittingClosing] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  // El total de caja sale del conteo fisico, no de las ventas capturadas: el
  // fondo operativo vive dentro del cajon, asi que lo contado YA lo incluye y
  // sumarle el saldo anterior lo duplicaria.
  const countedCash = cashTotal(closingCounts);
  const needsCut = countedCash > cashState.cashLimit;

  function clearStatusTimer() {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }

  function clearStatusMessage() {
    clearStatusTimer();
    setStatusMessage("");
  }

  function showStatusMessage(message: string, autoHide = false) {
    clearStatusTimer();
    setStatusMessage(message);

    if (autoHide) {
      statusTimerRef.current = window.setTimeout(() => {
        setStatusMessage("");
        statusTimerRef.current = null;
      }, SUCCESS_MESSAGE_DURATION_MS);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialState() {
      try {
        const response = await fetch("/api/caja", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "No se pudo cargar el saldo de caja.");
        }

        if (isActive) {
          setCashState(result);
        }
      } catch (error) {
        if (isActive) {
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el saldo de caja.",
          );
        }
      }
    }

    void loadInitialState();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    return () => clearStatusTimer();
  }, []);

  async function refreshCashState() {
    const response = await fetch("/api/caja", { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "No se pudo cargar el saldo de caja.");
    }

    setCashState(result);
    return result as CashState;
  }

  function resetClosingForm() {
    setClosingPerson("");
    setClosingShift("");
    setCashSales("");
    setCardSales("");
    setTransferSales("");
    setUberSales("");
    setClosingCounts(emptyCounts());
    setClosingNotes("");
  }

  function resetWithdrawalForm() {
    setWithdrawalPerson("");
    setWithdrawalShift("");
    setWithdrawalAmount("");
    setWithdrawalDescription("");
  }

  function closingFormIsComplete() {
    return (
      closingPerson &&
      closingShift &&
      hasNumber(cashSales) &&
      hasNumber(cardSales) &&
      hasNumber(transferSales) &&
      hasNumber(uberSales) &&
      denominations.every((denomination) =>
        hasNumber(closingCounts[denomination.key]),
      ) &&
      closingNotes.trim()
    );
  }

  async function submitClosing() {
    if (!closingFormIsComplete()) {
      showStatusMessage("Todos los campos del cierre son obligatorios.");
      return;
    }

    setIsSubmittingClosing(true);
    clearStatusMessage();

    try {
      const response = await fetch("/api/cierres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: closingPerson,
          shift: closingShift,
          cashSales: numeric(cashSales),
          cardSales: numeric(cardSales),
          transferSales: numeric(transferSales),
          uberSales: numeric(uberSales),
          countedCash,
          denominations: normalizedCounts(closingCounts),
          notes: closingNotes.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "No se pudo enviar el cierre.");
      }

      resetClosingForm();
      await refreshCashState();
      showStatusMessage("Cierre enviado.", true);
    } catch (error) {
      showStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el cierre.",
      );
    } finally {
      setIsSubmittingClosing(false);
    }
  }

  async function submitWithdrawal() {
    if (
      !withdrawalPerson ||
      !withdrawalShift ||
      !hasNumber(withdrawalAmount) ||
      numeric(withdrawalAmount) <= 0 ||
      !withdrawalDescription.trim()
    ) {
      showStatusMessage("Todos los campos del dinero retirado son obligatorios.");
      return;
    }

    setIsSubmittingWithdrawal(true);
    clearStatusMessage();

    try {
      const response = await fetch("/api/retiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: withdrawalPerson,
          shift: withdrawalShift,
          amount: numeric(withdrawalAmount),
          description: withdrawalDescription.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "No se pudo enviar el dinero retirado.");
      }

      resetWithdrawalForm();
      await refreshCashState();
      showStatusMessage("Dinero retirado enviado.", true);
    } catch (error) {
      showStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el dinero retirado.",
      );
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p>710 Coffee Bar</p>
        <h1>Caja de turno</h1>
      </header>

      <nav className="tab-bar" aria-label="Flujos de caja">
        <TabButton
          active={activeView === "cierre"}
          onClick={() => setActiveView("cierre")}
        >
          Cierre
        </TabButton>
        <TabButton
          active={activeView === "retiro"}
          onClick={() => setActiveView("retiro")}
        >
          Dinero retirado
        </TabButton>
      </nav>

      {statusMessage && <div className="status-message">{statusMessage}</div>}

      {activeView === "cierre" && (
        <section className="panel form-panel" aria-labelledby="closing-title">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitClosing();
            }}
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Cierre</p>
                <h2 id="closing-title">Registrar cierre</h2>
              </div>
            </div>

            <div className="form-grid">
              <SelectField
                label="Responsable"
                value={closingPerson}
                options={people}
                onChange={setClosingPerson}
              />
              <SelectField
                label="Turno"
                value={closingShift}
                options={shifts}
                onChange={setClosingShift}
                labelFor={shiftLabel}
              />
              <NumberField
                label="Ventas efectivo"
                value={cashSales}
                onChange={setCashSales}
              />
              <NumberField
                label="Ventas tarjeta"
                value={cardSales}
                onChange={setCardSales}
              />
              <NumberField
                label="Transferencias / otros"
                value={transferSales}
                onChange={setTransferSales}
              />
              <NumberField
                label="Uber Eats"
                value={uberSales}
                onChange={setUberSales}
              />
            </div>

            <div className="count-block">
              <p className="eyebrow">Conteo de caja</p>
              <p className="count-hint">
                Cuenta el efectivo que hay fisicamente en el cajon, incluyendo el
                fondo operativo.
              </p>
              <DenominationCounter
                counts={closingCounts}
                onChange={setClosingCounts}
              />
            </div>

            <div className="closing-result">
              <TotalBox label="Saldo anterior" value={money(cashState.currentBalance)} />
              <TotalBox label="Total" value={money(countedCash)} />
            </div>

            {needsCut && (
              <div className="cash-alert">
                <strong>Corte de caja pendiente</strong>
                <span>
                  La caja supera {money(cashState.cashLimit)}. El corte estandar es{" "}
                  {money(cashState.standardWithdrawal)}.
                </span>
              </div>
            )}

            <TextAreaField
              label="Observaciones"
              value={closingNotes}
              onChange={setClosingNotes}
              placeholder="Detalle del cierre"
            />

            <button
              className="submit-button"
              disabled={isSubmittingClosing}
              type="submit"
            >
              {isSubmittingClosing ? "Enviando cierre" : "Enviar cierre"}
            </button>
          </form>
        </section>
      )}

      {activeView === "retiro" && (
        <section className="panel form-panel" aria-labelledby="withdrawal-title">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitWithdrawal();
            }}
          >
            <div className="panel-header">
              <div>
                <p className="eyebrow">Corte</p>
                <h2 id="withdrawal-title">Dinero retirado</h2>
              </div>
            </div>

            <div className="form-grid">
              <SelectField
                label="Responsable"
                value={withdrawalPerson}
                options={people}
                onChange={setWithdrawalPerson}
              />
              <SelectField
                label="Turno"
                value={withdrawalShift}
                options={shifts}
                onChange={setWithdrawalShift}
                labelFor={shiftLabel}
              />
              <NumberField
                label="Monto retirado"
                value={withdrawalAmount}
                onChange={setWithdrawalAmount}
              />
              <TextField
                label="Descripción"
                value={withdrawalDescription}
                onChange={setWithdrawalDescription}
                placeholder="Ej. corte de caja, entrega a manager"
              />
            </div>

            <div className="closing-result">
              <TotalBox label="Saldo actual" value={money(cashState.currentBalance)} />
              <TotalBox
                label="Saldo después del retiro"
                value={money(cashState.currentBalance - numeric(withdrawalAmount))}
              />
            </div>

            <button
              className="submit-button"
              disabled={isSubmittingWithdrawal}
              type="submit"
            >
              {isSubmittingWithdrawal ? "Enviando retiro" : "Enviar dinero retirado"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

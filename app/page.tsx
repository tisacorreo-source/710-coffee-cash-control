"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SHIFTS, shiftLabel, type Shift } from "@/lib/shifts";

type View = "cierre" | "retiro";
type Person = "Veronica" | "Rodrigo" | "David" | "Chisco";
type SelectValue<T extends string> = T | "";
type NumberValue = number | "";

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

function numeric(value: NumberValue) {
  return Number(value) || 0;
}

function hasNumber(value: NumberValue) {
  return value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
}

function money(value: number) {
  return `Q${value.toLocaleString("en-US", {
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
  const [closingNotes, setClosingNotes] = useState("");
  const [withdrawalPerson, setWithdrawalPerson] =
    useState<SelectValue<Person>>("");
  const [withdrawalShift, setWithdrawalShift] = useState<SelectValue<Shift>>("");
  const [withdrawalAmount, setWithdrawalAmount] = useState<NumberValue>("");
  const [withdrawalDescription, setWithdrawalDescription] = useState("");
  const [isSubmittingClosing, setIsSubmittingClosing] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);

  const expectedCash = cashState.currentBalance + numeric(cashSales);
  const needsCut = expectedCash > cashState.cashLimit;

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

            <div className="closing-result">
              <TotalBox label="Saldo anterior" value={money(cashState.currentBalance)} />
              <TotalBox label="Caja esperada" value={money(expectedCash)} />
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

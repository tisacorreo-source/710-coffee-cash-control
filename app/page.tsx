"use client";

import { useMemo, useState } from "react";

type Person = "Veronica" | "Rodrigo" | "David" | "Chisco";
type Shift = "Manana" | "Tarde";
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

const BASE_CASH = 1000;
const LAST_CLOSING_ID_KEY = "710:last-closing-id";

const people: Person[] = ["Veronica", "Rodrigo", "David", "Chisco"];
const shifts: Shift[] = ["Manana", "Tarde"];

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
  return {
    q200: "",
    q100: "",
    q50: "",
    q20: "",
    q10: "",
    q5: "",
    q1: "",
    menores: "",
  };
}

function numeric(value: NumberValue) {
  return Number(value) || 0;
}

function cashTotal(counts: CashCounts) {
  return denominations.reduce((total, denomination) => {
    const rawValue = numeric(counts[denomination.key]);
    return (
      total +
      (denomination.mode === "amount"
        ? rawValue
        : rawValue * denomination.value)
    );
  }, 0);
}

function money(value: number) {
  return `Q${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
}: {
  label: string;
  value: SelectValue<T>;
  options: T[];
  onChange: (value: SelectValue<T>) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SelectValue<T>)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
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

export default function Home() {
  const [statusMessage, setStatusMessage] = useState("");
  const [closingPerson, setClosingPerson] = useState<SelectValue<Person>>("");
  const [closingShift, setClosingShift] = useState<SelectValue<Shift>>("");
  const [cashSales, setCashSales] = useState<NumberValue>("");
  const [cardSales, setCardSales] = useState<NumberValue>("");
  const [transferSales, setTransferSales] = useState<NumberValue>("");
  const [uberSales, setUberSales] = useState<NumberValue>("");
  const [withdrawnCash, setWithdrawnCash] = useState<NumberValue>("");
  const [withdrawalDescription, setWithdrawalDescription] = useState("");
  const [closingCounts, setClosingCounts] = useState<CashCounts>(emptyCounts);
  const [closingNotes, setClosingNotes] = useState("");
  const [lastClosingId, setLastClosingId] = useState("");
  const [showAnnulment, setShowAnnulment] = useState(false);
  const [managerPin, setManagerPin] = useState("");
  const [annulmentReason, setAnnulmentReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnnuling, setIsAnnuling] = useState(false);

  const closingCounted = useMemo(() => cashTotal(closingCounts), [closingCounts]);
  const expectedCash = BASE_CASH + numeric(cashSales) - numeric(withdrawnCash);

  function rememberClosingId(recordId: string) {
    if (!recordId) {
      forgetClosingId();
      return;
    }

    setLastClosingId(recordId);
    window.localStorage.setItem(LAST_CLOSING_ID_KEY, recordId);
  }

  function rememberedClosingId() {
    return window.localStorage.getItem(LAST_CLOSING_ID_KEY) || "";
  }

  function forgetClosingId() {
    setLastClosingId("");
    window.localStorage.removeItem(LAST_CLOSING_ID_KEY);
  }

  function resetClosingForm() {
    setClosingPerson("");
    setClosingShift("");
    setCashSales("");
    setCardSales("");
    setTransferSales("");
    setUberSales("");
    setWithdrawnCash("");
    setWithdrawalDescription("");
    setClosingCounts(emptyCounts());
    setClosingNotes("");
  }

  function resetAnnulmentForm() {
    setManagerPin("");
    setAnnulmentReason("");
  }

  async function submitClosing() {
    if (!closingPerson || !closingShift) {
      setStatusMessage("Falta elegir responsable y turno.");
      return;
    }

    if (numeric(withdrawnCash) > 0 && !withdrawalDescription.trim()) {
      setStatusMessage("Falta describir el dinero retirado.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

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
          withdrawnCash: numeric(withdrawnCash),
          withdrawalDescription: withdrawalDescription.trim(),
          expectedCash,
          countedCash: closingCounted,
          denominations: normalizedCounts(closingCounts),
          notes: closingNotes.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "No se pudo enviar el cierre.");
      }

      rememberClosingId(result.recordId || "");
      resetClosingForm();
      resetAnnulmentForm();
      setShowAnnulment(false);
      setStatusMessage(
        result.persisted
          ? `Cierre enviado a Sheets. ID: ${result.recordId}.`
          : `Cierre registrado en modo local. ID: ${result.recordId}.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el cierre.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAnnulment() {
    if (!showAnnulment) {
      setShowAnnulment(true);
      return;
    }

    if (!managerPin.trim()) {
      setStatusMessage("Falta ingresar el PIN del manager.");
      return;
    }

    if (!annulmentReason.trim()) {
      setStatusMessage("Falta describir la razón de la anulación.");
      return;
    }

    setIsAnnuling(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/cierres/anular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: lastClosingId || rememberedClosingId(),
          managerPin,
          reason: annulmentReason.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "No se pudo anular el cierre.");
      }

      resetClosingForm();
      resetAnnulmentForm();
      forgetClosingId();
      setShowAnnulment(false);
      setStatusMessage(
        result.deleted
          ? "Cierre anulado. Puedes volver a registrar el turno."
          : "Registro local anulado. Puedes volver a registrar el turno.",
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "No se pudo anular el cierre.",
      );
    } finally {
      setIsAnnuling(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p>710 Coffee Bar</p>
        <h1>Cierre de turno</h1>
      </header>

      {statusMessage && <div className="status-message">{statusMessage}</div>}

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
            {lastClosingId && (
              <span className="record-pill">ID {lastClosingId.slice(0, 8)}</span>
            )}
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
            <NumberField label="Uber Eats" value={uberSales} onChange={setUberSales} />
            <NumberField
              label="Dinero retirado"
              value={withdrawnCash}
              onChange={setWithdrawnCash}
            />
            <TextField
              label="Descripción del dinero retirado"
              value={withdrawalDescription}
              onChange={setWithdrawalDescription}
              placeholder="Ej. entrega a manager, depósito, proveedor"
            />
          </div>

          <DenominationCounter counts={closingCounts} onChange={setClosingCounts} />

          <div className="closing-result">
            <TotalBox label="Caja esperada" value={money(expectedCash)} />
            <TotalBox label="Caja contada" value={money(closingCounted)} />
          </div>

          <TextAreaField
            label="Observaciones"
            value={closingNotes}
            onChange={setClosingNotes}
            placeholder="Opcional"
          />

          <button className="submit-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Enviando cierre" : "Enviar cierre"}
          </button>
        </form>

        <div className="annulment-zone">
          {showAnnulment && (
            <div className="annulment-fields">
              <label className="field">
                <span>PIN manager</span>
                <input
                  type="password"
                  value={managerPin}
                  onChange={(event) => setManagerPin(event.target.value)}
                />
              </label>
              <TextAreaField
                label="Razón de anulación"
                value={annulmentReason}
                onChange={setAnnulmentReason}
                placeholder="Ej. error de conteo o cierre duplicado"
              />
            </div>
          )}

          <button
            className="danger-button"
            disabled={isAnnuling}
            type="button"
            onClick={() => void handleAnnulment()}
          >
            {isAnnuling ? "Anulando" : "Anular"}
          </button>
        </div>
      </section>
    </main>
  );
}

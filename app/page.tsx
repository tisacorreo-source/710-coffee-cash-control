"use client";

import { useMemo, useState } from "react";

type Action = "apertura" | "cierre" | "movimiento" | "admin";
type Person = "Veronica" | "Rodrigo" | "David" | "Chisco";
type Shift = "Manana" | "Tarde";
type MovementType = "gasto" | "retiro";
type AdminAction = "correccion" | "anulacion";
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

type ShiftState = {
  person: Person;
  initialCash: number;
  openedAt: string;
};

type MovementRecord = {
  person: Person;
  shift: Shift;
  type: MovementType;
  description: string;
  amount: number;
  notes: string;
  createdAt: string;
};

type AdminRecord = {
  action: AdminAction;
  reference: string;
  reason: string;
  createdAt: string;
};

const BASE_CASH = 1000;
const CASH_LIMIT = 4000;
const ADMIN_PIN = "0710";

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

const quickReasons: Record<MovementType, string[]> = {
  gasto: ["Hielo", "Proveedor", "Compra de caja", "Otro gasto"],
  retiro: ["Cierre parcial", "Entrega a manager", "Deposito", "Otro retiro"],
};

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

function nowLabel() {
  return new Date().toLocaleString("es-GT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  });
}

function differenceTone(value: number) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function ActionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`action-button ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
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
      <select value={value} onChange={(event) => onChange(event.target.value as SelectValue<T>)}>
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

function TotalBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className={`total-box ${tone ? `tone-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Home() {
  const [action, setAction] = useState<Action>("apertura");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeShifts, setActiveShifts] = useState<Partial<Record<Shift, ShiftState>>>({});
  const [movements, setMovements] = useState<MovementRecord[]>([]);
  const [, setAdminRecords] = useState<AdminRecord[]>([]);

  const [openingPerson, setOpeningPerson] = useState<SelectValue<Person>>("");
  const [openingShift, setOpeningShift] = useState<SelectValue<Shift>>("");
  const [openingCounts, setOpeningCounts] = useState<CashCounts>(emptyCounts);
  const [openingNotes, setOpeningNotes] = useState("");

  const [closingPerson, setClosingPerson] = useState<SelectValue<Person>>("");
  const [closingShift, setClosingShift] = useState<SelectValue<Shift>>("");
  const [cashSales, setCashSales] = useState<NumberValue>("");
  const [cardSales, setCardSales] = useState<NumberValue>("");
  const [transferSales, setTransferSales] = useState<NumberValue>("");
  const [uberSales, setUberSales] = useState<NumberValue>("");
  const [closingCounts, setClosingCounts] = useState<CashCounts>(emptyCounts);
  const [closingNotes, setClosingNotes] = useState("");

  const [movementPerson, setMovementPerson] = useState<SelectValue<Person>>("");
  const [movementShift, setMovementShift] = useState<SelectValue<Shift>>("");
  const [movementType, setMovementType] = useState<SelectValue<MovementType>>("");
  const [movementDescription, setMovementDescription] = useState("");
  const [movementAmount, setMovementAmount] = useState<NumberValue>("");
  const [movementCashNow, setMovementCashNow] = useState<NumberValue>("");
  const [movementNotes, setMovementNotes] = useState("");

  const [adminAction, setAdminAction] = useState<SelectValue<AdminAction>>("");
  const [adminReference, setAdminReference] = useState("");
  const [adminReason, setAdminReason] = useState("");
  const [adminPin, setAdminPin] = useState("");

  const openingTotal = useMemo(() => cashTotal(openingCounts), [openingCounts]);
  const closingCounted = useMemo(() => cashTotal(closingCounts), [closingCounts]);

  const movementSuggestion =
    numeric(movementCashNow) >= CASH_LIMIT
      ? Math.max(numeric(movementCashNow) - BASE_CASH, 0)
      : 0;

  const closingMovements = closingShift
    ? movements.filter((movement) => movement.shift === closingShift)
    : [];

  const expenseTotal = closingMovements
    .filter((movement) => movement.type === "gasto")
    .reduce((sum, movement) => sum + movement.amount, 0);

  const withdrawalTotal = closingMovements
    .filter((movement) => movement.type === "retiro")
    .reduce((sum, movement) => sum + movement.amount, 0);

  const closingInitialCash = closingShift
    ? activeShifts[closingShift]?.initialCash || BASE_CASH
    : BASE_CASH;
  const totalSales =
    numeric(cashSales) +
    numeric(cardSales) +
    numeric(transferSales) +
    numeric(uberSales);
  const expectedCash =
    closingInitialCash + numeric(cashSales) - expenseTotal - withdrawalTotal;
  const closingDifference = closingCounted - expectedCash;
  const cashToSeparate = Math.max(closingCounted - BASE_CASH, 0);

  function resetOpeningForm() {
    setOpeningPerson("");
    setOpeningShift("");
    setOpeningCounts(emptyCounts());
    setOpeningNotes("");
  }

  function resetMovementForm() {
    setMovementPerson("");
    setMovementShift("");
    setMovementType("");
    setMovementDescription("");
    setMovementAmount("");
    setMovementCashNow("");
    setMovementNotes("");
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

  function resetAdminForm() {
    setAdminAction("");
    setAdminReference("");
    setAdminReason("");
    setAdminPin("");
  }

  function submitOpening() {
    if (!openingPerson || !openingShift) {
      setStatusMessage("Falta elegir responsable y turno.");
      return;
    }

    setActiveShifts((current) => ({
      ...current,
      [openingShift]: {
        person: openingPerson,
        initialCash: openingTotal,
        openedAt: nowLabel(),
      },
    }));
    resetOpeningForm();
    setStatusMessage(`Apertura enviada. Total registrado: ${money(openingTotal)}.`);
  }

  function submitMovement() {
    if (
      !movementPerson ||
      !movementShift ||
      !movementType ||
      !movementDescription.trim() ||
      numeric(movementAmount) <= 0
    ) {
      setStatusMessage("Falta responsable, turno, tipo, descripción o monto.");
      return;
    }

    setMovements((current) => [
      ...current,
      {
        person: movementPerson,
        shift: movementShift,
        type: movementType,
        description: movementDescription.trim(),
        amount: numeric(movementAmount),
        notes: movementNotes,
        createdAt: nowLabel(),
      },
    ]);
    resetMovementForm();
    setStatusMessage("Movimiento enviado. Formulario limpio.");
  }

  function submitClosing() {
    if (!closingPerson || !closingShift) {
      setStatusMessage("Falta elegir responsable y turno.");
      return;
    }

    setActiveShifts((current) => {
      const next = { ...current };
      delete next[closingShift];
      return next;
    });
    setMovements((current) =>
      current.filter((movement) => movement.shift !== closingShift),
    );
    resetClosingForm();
    setStatusMessage(
      `Cierre enviado. Diferencia registrada: ${money(closingDifference)}.`,
    );
  }

  function submitAdmin() {
    if (adminPin !== ADMIN_PIN) {
      setStatusMessage("PIN admin incorrecto.");
      return;
    }

    if (!adminAction || !adminReference.trim() || !adminReason.trim()) {
      setStatusMessage("Falta acción, referencia o razón.");
      return;
    }

    setAdminRecords((current) => [
      ...current,
      {
        action: adminAction,
        reference: adminReference.trim(),
        reason: adminReason.trim(),
        createdAt: nowLabel(),
      },
    ]);
    resetAdminForm();
    setStatusMessage("Corrección/anulación enviada.");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p>710 Coffee Bar</p>
        <h1>Control de Caja</h1>
      </header>

      <nav className="action-grid" aria-label="Acciones principales">
        <ActionButton
          active={action === "apertura"}
          label="Abrir turno"
          onClick={() => setAction("apertura")}
        />
        <ActionButton
          active={action === "cierre"}
          label="Cerrar turno"
          onClick={() => setAction("cierre")}
        />
        <ActionButton
          active={action === "movimiento"}
          label="Movimiento de caja"
          onClick={() => setAction("movimiento")}
        />
        <ActionButton
          active={action === "admin"}
          label="Corrección / Anulación"
          onClick={() => setAction("admin")}
        />
      </nav>

      {statusMessage && <div className="status-message">{statusMessage}</div>}

      <section className="panel form-panel">
        {action === "apertura" && (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Apertura</p>
                <h2>Abrir turno</h2>
              </div>
            </div>

            <div className="form-grid">
              <SelectField
                label="Responsable"
                value={openingPerson}
                options={people}
                onChange={setOpeningPerson}
              />
              <SelectField
                label="Turno"
                value={openingShift}
                options={shifts}
                onChange={setOpeningShift}
              />
            </div>

            <DenominationCounter counts={openingCounts} onChange={setOpeningCounts} />

            <TotalBox label="Total de dinero en caja" value={money(openingTotal)} />

            <TextAreaField
              label="Observaciones"
              value={openingNotes}
              onChange={setOpeningNotes}
              placeholder="Opcional"
            />

            <button className="submit-button" type="button" onClick={submitOpening}>
              Enviar apertura
            </button>
          </>
        )}

        {action === "cierre" && (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Cierre</p>
                <h2>Cerrar turno</h2>
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
            </div>

            <div className="mini-totals">
              <TotalBox label="Caja inicial" value={money(closingInitialCash)} />
              <TotalBox label="Ventas totales" value={money(totalSales)} />
              <TotalBox label="Gastos del turno" value={money(expenseTotal)} />
              <TotalBox label="Retiros del turno" value={money(withdrawalTotal)} />
            </div>

            <DenominationCounter counts={closingCounts} onChange={setClosingCounts} />

            <div className="closing-result">
              <TotalBox label="Caja esperada" value={money(expectedCash)} />
              <TotalBox label="Caja contada" value={money(closingCounted)} />
              <TotalBox
                label="Diferencia"
                value={money(closingDifference)}
                tone={differenceTone(closingDifference)}
              />
              <TotalBox label="Dejar en caja" value={money(BASE_CASH)} />
              <TotalBox label="Guardar aparte" value={money(cashToSeparate)} />
            </div>

            <TextAreaField
              label="Observaciones"
              value={closingNotes}
              onChange={setClosingNotes}
              placeholder="Opcional"
            />

            <button className="submit-button" type="button" onClick={submitClosing}>
              Enviar cierre
            </button>
          </>
        )}

        {action === "movimiento" && (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Movimiento</p>
                <h2>Movimiento de caja</h2>
              </div>
            </div>

            <div className="form-grid">
              <SelectField
                label="Responsable"
                value={movementPerson}
                options={people}
                onChange={setMovementPerson}
              />
              <SelectField
                label="Turno"
                value={movementShift}
                options={shifts}
                onChange={setMovementShift}
              />
              <SelectField
                label="Tipo"
                value={movementType}
                options={["gasto", "retiro"]}
                onChange={(value) => {
                  setMovementType(value);
                  setMovementDescription(value ? quickReasons[value][0] : "");
                }}
              />
              <NumberField
                label="Monto"
                value={movementAmount}
                onChange={setMovementAmount}
              />
              <NumberField
                label="Efectivo actual en caja"
                value={movementCashNow}
                onChange={setMovementCashNow}
              />
            </div>

            {movementType && (
              <div className="quick-reasons">
                {quickReasons[movementType].map((reason) => (
                  <button
                    className={movementDescription === reason ? "selected" : ""}
                    key={reason}
                    type="button"
                    onClick={() => setMovementDescription(reason)}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}

            <TextField
              label="Descripción o razón"
              value={movementDescription}
              onChange={setMovementDescription}
              placeholder="Ej. Hielo, cierre parcial, proveedor"
            />

            {movementSuggestion > 0 && (
              <div className="cash-alert">
                <strong>Retiro sugerido: {money(movementSuggestion)}</strong>
                <span>La caja quedaria en {money(BASE_CASH)}.</span>
                <button
                  type="button"
                  onClick={() => {
                    setMovementType("retiro");
                    setMovementDescription("Cierre parcial");
                    setMovementAmount(movementSuggestion);
                  }}
                >
                  Usar sugerencia
                </button>
              </div>
            )}

            <TextAreaField
              label="Observaciones"
              value={movementNotes}
              onChange={setMovementNotes}
              placeholder="Opcional"
            />

            <button className="submit-button" type="button" onClick={submitMovement}>
              Enviar movimiento
            </button>
          </>
        )}

        {action === "admin" && (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Admin David</p>
                <h2>Corrección / Anulación</h2>
              </div>
            </div>

            <div className="form-grid">
              <SelectField
                label="Acción"
                value={adminAction}
                options={["correccion", "anulacion"]}
                onChange={setAdminAction}
              />
              <label className="field">
                <span>PIN David</span>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(event) => setAdminPin(event.target.value)}
                />
              </label>
            </div>

            <TextField
              label="Registro o referencia"
              value={adminReference}
              onChange={setAdminReference}
              placeholder="Ej. cierre Manana 4/8, folio o nota"
            />
            <TextAreaField
              label="Razón"
              value={adminReason}
              onChange={setAdminReason}
              placeholder="Explicar que se corrige o anula"
            />

            <button className="submit-button" type="button" onClick={submitAdmin}>
              Enviar corrección / anulación
            </button>
          </>
        )}
      </section>
    </main>
  );
}

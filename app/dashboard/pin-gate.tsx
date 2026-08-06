"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { IconLock } from "./components";

export function PinGate() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!pin.trim()) {
      setError("Escribe el PIN.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/dashboard/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "No se pudo validar el PIN.");
      }

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo validar el PIN.",
      );
      setPin("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dash-gate">
      <form className="dash-gate-card" onSubmit={submit}>
        <span className="dash-brand" aria-label="7-10 Coffee">
          7-10 <small>Coffee</small>
        </span>
        <h1>Dashboard administrativo</h1>
        <p>Ingresa el PIN para consultar la información de caja.</p>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          aria-label="PIN de acceso"
          placeholder="••••"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />

        {error && <p className="dash-gate-error">{error}</p>}

        <button className="dash-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Validando" : "Entrar"}
        </button>

        <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <IconLock size={15} />
          Solo consulta. Desde aquí no se registran cierres ni retiros.
        </p>
      </form>
    </div>
  );
}

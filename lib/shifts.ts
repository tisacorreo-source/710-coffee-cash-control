/**
 * Fuente unica de verdad de los turnos de 7-10 Coffee.
 *
 * EL NEGOCIO OPERA CON DOS TURNOS: MANANA Y TARDE. NO EXISTE TURNO DE NOCHE.
 *
 * El brief de diseno del dashboard y su mockup de referencia muestran un tercer
 * turno de noche; eso fue un error del material de diseno, no un requerimiento.
 * No agregar un turno nuevo aqui sin confirmarlo con el dueno: el turno viaja
 * hasta la hoja de calculo y una etiqueta inventada ensucia el historico.
 *
 * El valor que se guarda en Sheets es "Manana", sin enie, porque asi se
 * escribieron los registros existentes. `shiftLabel` es lo que se muestra.
 */

export const SHIFTS = ["Manana", "Tarde"] as const;

export type Shift = (typeof SHIFTS)[number];

const SHIFT_LABELS: Record<string, string> = {
  manana: "Mañana",
  tarde: "Tarde",
};

/** Texto para pantalla. Devuelve el valor original si es un turno desconocido. */
export function shiftLabel(shift: string): string {
  const normalized = shift.trim().toLowerCase();
  return SHIFT_LABELS[normalized] || shift.trim();
}

/** Clase de color para la etiqueta de turno en el dashboard. */
export function shiftClass(shift: string): string {
  const normalized = shift.trim().toLowerCase();
  if (normalized === "manana") return "is-manana";
  if (normalized === "tarde") return "is-tarde";
  return "";
}

# 710 Coffee Bar - Caja de Turno

Prototipo web para registrar cierres de turno y dinero retirado con una caja
continua. La caja no se reinicia por dia: el saldo anterior se toma del ultimo
cierre enviado y se ajusta con los retiros registrados despues de ese cierre.

## Comandos

```bash
npm install
npm run dev -- --hostname 127.0.0.1
npm run build
npm test
```

## Google Sheets / Drive

El backend incluye rutas para guardar cierres y retiros en Google Sheets. Si no
hay credenciales configuradas, las rutas responden en modo prototipo local para
poder probar la interfaz.

Hoja creada para el MVP:

- Sheet: https://docs.google.com/spreadsheets/d/1gc55THi4wkhZ_3oU_vP7qr6E88sRTwvZAHwWR4SnsBE/edit
- Carpeta Drive: https://drive.google.com/drive/folders/1HGlUJ2-SLJKBWD65iW0vctTNb0gH4K90
- Pestañas activas del backend: `cierres`, `retiros`
- Pestañas preparadas para estructura: `estado_caja`, `anulaciones`

Variables esperadas:

```bash
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=1gc55THi4wkhZ_3oU_vP7qr6E88sRTwvZAHwWR4SnsBE
GOOGLE_SHEETS_CLOSINGS_SHEET=cierres
GOOGLE_SHEETS_WITHDRAWALS_SHEET=retiros
GOOGLE_SHEETS_CONFIG_SHEET=estado_caja
GOOGLE_SHEETS_CANCELLATIONS_SHEET=anulaciones
GOOGLE_DRIVE_FOLDER_ID=
DASHBOARD_PIN=
```

La cuenta de servicio debe tener acceso al Sheet destino. `GOOGLE_DRIVE_FOLDER_ID`
queda reservado para una fase posterior con Shared Drive u OAuth; en "Mi unidad",
Google no permite que una service account cree archivos propios de auditoria por
falta de cuota de almacenamiento.

Para produccion, crear una cuenta de servicio con acceso a Google Sheets y Drive,
compartir la hoja y la carpeta con ese email como editor, y configurar las
variables anteriores en Vercel. Se puede usar `GOOGLE_SERVICE_ACCOUNT_JSON`
con el JSON completo de la cuenta, o `GOOGLE_SERVICE_ACCOUNT_EMAIL` +
`GOOGLE_PRIVATE_KEY`. `GOOGLE_PRIVATE_KEY` debe guardarse como secreto, con
saltos de linea reales o escapados como `\n`.

## Turnos

**El negocio opera con dos turnos: manana y tarde. No existe turno de noche.**

El brief de diseno del dashboard y su mockup de referencia muestran un tercer
turno de noche. Fue un error del material de diseno y no se implemento.

- Definicion unica en [`lib/shifts.ts`](lib/shifts.ts); la app de cierre y el
  dashboard leen de ahi. No duplicar la lista.
- En Sheets se guarda `Manana`, sin enie, porque asi estan los registros
  existentes. `shiftLabel()` es la que muestra "Mañana" en pantalla.
- Hay tests que fallan si alguien reintroduce un turno de noche.

## Flujo del prototipo

- Registrar cierre con responsable, turno, ventas, conteo y observaciones.
- Registrar dinero retirado en una pestaña separada.
- Calcular caja esperada con saldo continuo.
- Sugerir corte cuando la caja esperada supera Q4,000.
- Mantener fondo operativo de referencia en Q1,000 y corte estandar en Q3,000.

## Dashboard administrativo (`/dashboard`)

Piloto **solo de consulta** para el dueño / manager. No escribe nada: no
registra cierres, retiros ni cambios de configuracion.

Rutas:

| Ruta | Pantalla |
| --- | --- |
| `/dashboard` | Resumen: KPIs, metodos de pago, control de efectivo, avisos, actividad |
| `/dashboard/cierres` | Listado de cierres con filtro por turno |
| `/dashboard/cierres/[id]` | Detalle de un cierre |
| `/dashboard/movimientos` | Entradas y salidas de efectivo, agrupadas por dia |
| `/dashboard/reportes` | Tendencia por dia, desglose por metodo, configuracion, sesion |

Detalles de implementacion:

- `GET /api/dashboard` devuelve un snapshot completo (cierres, retiros,
  anulaciones y configuracion). El filtrado por periodo se hace en el cliente,
  asi que cambiar de rango no vuelve a pegarle a Sheets.
- Los periodos se calculan sobre el dia calendario de `America/Guatemala`, no
  sobre UTC. Sin esto "Hoy" estaria mal durante seis horas al dia.
- El acceso se protege con `DASHBOARD_PIN` y una cookie firmada con HMAC
  (`httpOnly`, 30 dias). **Si `DASHBOARD_PIN` falta en produccion el dashboard
  se cierra**, no se abre: un secreto ausente no debe desactivar la
  autenticacion en silencio.
- Los umbrales (`base_cash`, `cash_limit`, `standard_withdrawal`) se leen de la
  pestaña `estado_caja`, con los valores del codigo como respaldo.

### Datos que el dashboard no puede mostrar

El formulario de cierre no pide el efectivo contado fisicamente: el backend
guarda `caja_contada = caja_esperada` y `denominaciones_json = {}`. Por eso el
dashboard **no** muestra diferencia de caja ni estado "cuadrada / sobra /
falta", y lo declara explicitamente como dato no disponible en pantalla. Para
habilitarlo hay que volver a pedir el conteo en la app de cierre.

Lo mismo con `anulaciones`: la pestaña existe y el dashboard ya la lee, pero
ninguna parte de la app escribe en ella todavia.

## Traspaso de la cuenta de Google al cliente

El cliente queda como dueño del Sheet y de la carpeta de Drive; el proyecto de
Google Cloud y la cuenta de servicio siguen del lado del desarrollador. No hay
que cambiar ninguna variable de entorno mientras el `SPREADSHEET_ID` no cambie.

1. Desde la cuenta que hoy es dueña, abrir el Sheet → Compartir → agregar la
   cuenta del cliente como **Editor**.
2. En el mismo panel, "Transferir propiedad" a la cuenta del cliente y aceptar
   la invitacion desde la cuenta del cliente.
3. Repetir 1 y 2 con la carpeta de Drive.
4. Confirmar que `id-10-coffee-cash-control@coffee-cash-control.iam.gserviceaccount.com`
   sigue como **Editor** del Sheet. Si se pierde ese permiso la app deja de
   escribir cierres y retiros.
5. Verificar que `/api/caja` responda `"mode": "sheets"`.

Entre cuentas de Gmail personales la transferencia es directa. Si alguna de las
dos es Workspace de otro dominio, Google no permite transferir propiedad: hay
que hacer una copia del archivo desde la cuenta del cliente, volver a compartir
con la cuenta de servicio y actualizar `GOOGLE_SHEETS_SPREADSHEET_ID` en Vercel.

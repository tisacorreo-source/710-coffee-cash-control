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

### Conteo de caja y diferencia

El cierre pide el **conteo fisico del efectivo** por denominaciones (Q200 a Q1
mas un monto suelto de monedas menores). De ahi salen `caja_contada` y
`denominaciones_json`, y con eso la diferencia es un dato real:

```
diferencia = caja_contada - caja_esperada
```

Positivo = sobra dinero en el cajon; negativo = falta. El dashboard lo usa para
el estado "cuadrada / sobra / falta", para la alerta de cierres con diferencia y
para la columna de cada cierre.

**No volver a quitarlo sin pensarlo dos veces.** Ya se quito una vez (commit
`b8c7a3e`, agosto 2026) y durante ese periodo la app registraba lo que el
sistema suponia que debia haber, sin que nadie verificara el cajon: era
imposible detectar un faltante. Hay tests en `tests/rendered-html.test.mjs` que
fallan si el conteo desaparece del formulario o de la API.

### Datos que el dashboard no puede mostrar

`anulaciones`: la pestaña existe y el dashboard ya la lee, pero ninguna parte de
la app escribe en ella todavia.

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

### Al transferir la propiedad, Google borra la cuenta de servicio

Esto ya paso una vez y dejo la app caida con `403 PERMISSION_DENIED`.

**En cuanto el nuevo dueño acepta la propiedad, Google elimina a la cuenta de
servicio de la lista de accesos.** No importa que estuviera como Editor antes de
la transferencia: desaparece. Los datos no se pierden, pero la app deja de leer
y de escribir hasta que se restaure el permiso.

Peor aun: el dueño anterior queda como Editor y **ya no puede volver a
compartir** el archivo. Google le responde "No se puede compartir contenido en
este momento". Solo el nuevo dueño puede reponer el permiso.

Procedimiento correcto, en este orden:

1. Transferir la propiedad y esperar a que el cliente acepte.
2. **Desde la cuenta del nuevo dueño**, volver a agregar
   `id-10-coffee-cash-control@coffee-cash-control.iam.gserviceaccount.com`
   como Editor del Sheet.
3. Verificar con `curl https://<app>/api/caja` que responda `"mode": "sheets"`.
   Si responde `403` o `{"message": ...}`, el permiso no quedo.

Google tambien marca el archivo transferido como **spam** en el Drive del nuevo
dueño. Hay que abrirlo y pulsar "No es spam" para que no acabe borrado.

La carpeta de Drive no afecta a la app: `GOOGLE_DRIVE_FOLDER_ID` esta vacio y el
codigo no la usa. Solo el Sheet es critico.

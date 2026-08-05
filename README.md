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
GOOGLE_DRIVE_FOLDER_ID=
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

## Flujo del prototipo

- Registrar cierre con responsable, turno, ventas, conteo y observaciones.
- Registrar dinero retirado en una pestaña separada.
- Calcular caja esperada con saldo continuo.
- Sugerir corte cuando la caja esperada supera Q4,000.
- Mantener fondo operativo de referencia en Q1,000 y corte estandar en Q3,000.

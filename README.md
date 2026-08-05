# 710 Coffee Bar - Cierre de Turno

Prototipo web para registrar cierres de turno de forma directa. La pantalla
principal solo permite enviar el cierre y anular el último registro con PIN de
manager.

## Comandos

```bash
npm install
npm run dev -- --hostname 127.0.0.1
npm run build
npm test
```

## Google Sheets / Drive

El backend ya incluye rutas para guardar cierres en Google Sheets y anular el
registro correspondiente. Si no hay credenciales configuradas, las rutas
responden en modo prototipo local para poder probar la interfaz.

Variables esperadas:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_CLOSINGS_SHEET=cierres
GOOGLE_SHEETS_ANNULMENTS_SHEET=anulaciones
GOOGLE_DRIVE_FOLDER_ID=
MANAGER_ANNUL_PIN=0710
```

La cuenta de servicio debe tener acceso al Sheet destino. Si se configura
`GOOGLE_DRIVE_FOLDER_ID`, tambien se guarda un archivo JSON de auditoria en esa
carpeta.

## Flujo del prototipo

- Registrar responsable y turno.
- Capturar ventas, dinero retirado y descripcion.
- Contar denominaciones de efectivo.
- Enviar cierre.
- Anular el ultimo cierre con PIN de manager si hubo un problema.

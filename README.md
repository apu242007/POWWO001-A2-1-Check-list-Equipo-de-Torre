# POWWO001-A2-1 · Check List Equipo de Torre (REV2)

SPA pública (sin login) para cargar el check list de equipo de torre desde el celular.
Los datos se archivan en dos listas de SharePoint vía un trigger HTTP de Power Automate,
y se notifica por mail con el PDF adjunto.

```text
[Cualquier usuario]
   │  HTTPS POST (JSON)
   ▼
[GitHub Pages SPA] ──VITE_POWER_AUTOMATE_URL──▶ [Power Automate HTTP trigger]
                                                     ├─▶ Create item      (Check List Equipo de Torre)
                                                     ├─▶ Add attachment × N (PDF + 3 firmas + evidencias)
                                                     ├─▶ Create item × ~130 (CheckListEquipodeTorre Items)
                                                     └─▶ Send email V2
```

| | |
| --- | --- |
| **Repo** | [apu242007/POWWO001-A2-1-Check-list-Equipo-de-Torre](https://github.com/apu242007/POWWO001-A2-1-Check-list-Equipo-de-Torre) |
| **App** | [apu242007.github.io/POWWO001-A2-1-Check-list-Equipo-de-Torre](https://apu242007.github.io/POWWO001-A2-1-Check-list-Equipo-de-Torre/) |
| **Lista cabecera** | [Check List Equipo de Torre](https://tackersrl505.sharepoint.com/sites/TODOTACKER480/Lists/Check%20List%20Equipo%20de%20Torre/AllItems.aspx) |
| **Lista de ítems** | [CheckListEquipodeTorre Items](https://tackersrl505.sharepoint.com/sites/TODOTACKER480/Lists/CheckListEquipodeTorre%20Items/AllItems.aspx) |
| **Folio** | `ET-YYYYMMDD-NNNN` |

## Contenido del formulario

| Bloque | Detalle |
| --- | --- |
| Datos generales | Site conducted (desplegable de equipos TKR), Conducted on, Confeccionado por, Location (+ GPS opcional) |
| Check list | **16 secciones · 128 ítems** BIEN / MAL / N/A |
| Evidencia | Un ítem en **MAL** exige foto obligatoria (comentario opcional) |
| Campos de sección | 14 campos de texto libre que identifican cada bloque |
| Observaciones | Repetibles: detalle + estado (Abierto/Cerrado) + fecha de cumplimiento |
| Firmas | 3 obligatorias: Jefe de Equipo, Técnico HSE, Inspección Cliente (nombre + firma + fecha) |
| Declaración | Casilla de declaración jurada final |

Distribución de ítems por sección: General 9 · Contravientos 10 · Fundación 1 ·
Herramientas de mano 3 · Condición de trabajo mástil 12 · Mástil-Torre 17 ·
Llave de potencia 6 · Conjunto del pozo/aparejo 6 · Sistema de circulación/lodo 3 ·
Vehículos 3 · Casilla de personal 10 · Camión de transporte 14 ·
Estación de operación/piso 8 · Equipamiento control del pozo 2 · Safety Equipment 5 · Annex 19.

## Estructura

```text
.
├── web-app/                  React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── types.ts                    catálogo de secciones/ítems + shape del draft
│   │   ├── components/InspectionForm.tsx
│   │   ├── components/SignaturePad.tsx
│   │   ├── lib/{imageUtils,draftStorage,inspectorProfile,pdfGenerator}.ts
│   │   └── services/uploadInspeccion.ts payload + POST al flow
│   └── public/{manifest.json,sw.js,tacker-logo.png}
├── sharepoint/
│   └── Setup-AllColumns-EquipoTorre.ps1  columnas idempotentes (device code auth)
├── power-automate/
│   └── Flow-EquipoTorre.md               diseño del flujo, campo por campo
└── .github/workflows/deploy-pages.yml
```

## Puesta en marcha

### Ya hecho ✅

1. **Listas creadas** en SharePoint (por UI — REST está bloqueado por policy del tenant).
   - `Check List Equipo de Torre` — `c1a4fdf9-4c55-4e51-a5d9-023268d11a4f`
   - `CheckListEquipodeTorre Items` — `8f96f01c-2008-467e-b9b7-aae30d5c79a5`
2. **40 columnas creadas** con `sharepoint/Setup-AllColumns-EquipoTorre.ps1` (33 en la cabecera,
   7 en la hija). InternalNames ASCII, nombres visibles con acentos.
3. **Lookup `Inspeccion` creada** en la lista hija vía `createfieldasxml` (apunta a la cabecera
   por `Title`). La columna `Title` quedó renombrada a `Folio` / `Ítem` respectivamente.
4. **Round-trip REST verificado**: acentos (`Cañadón`, `Mástil`, `Señalización`), Choices
   (`OBSERVADO`, `MAL`, `Abierto`, `OBSERVACION`), Number, Boolean, DateTime, adjunto binario y
   la lookup resolviendo al ID del padre. Los datos de prueba se borraron: ambas listas en 0.

### Pendiente

1. **Armar el flujo** siguiendo `power-automate/Flow-EquipoTorre.md` al pie de la letra.
2. **Copiar la URL del trigger** y exportar el paquete `.zip` al repo.
3. **Cargar los secrets** en GitHub: `VITE_POWER_AUTOMATE_URL` y `VITE_TACKER_KEY`.
   Hasta que estén cargados la app corre en modo demo.
4. **Probar end-to-end desde un celular real**: cargar, firmar, enviar; verificar el item de
   SharePoint, los adjuntos, los ~130 ítems hijos y el mail.

Sin el flujo la SPA no da error: los datos simplemente desaparecen.

### Correr el script de columnas de nuevo

Es idempotente — reporta `= ya existe` y no rompe nada:

```powershell
pwsh -File sharepoint\Setup-AllColumns-EquipoTorre.ps1
```

Pide device code (`https://microsoft.com/devicelogin`) sólo si el refresh token cacheado en
`%LOCALAPPDATA%\tacker-sp-eqtorre.rt` venció o se agotó.

## Desarrollo local

```bash
cd web-app
npm install
npm run dev      # sin VITE_POWER_AUTOMATE_URL arranca en MODO DEMO
npm run lint     # tsc --noEmit
npm run build
```

En modo demo el formulario funciona completo (validación, PDF, firmas) pero **no hace el POST**
y lo avisa con un banner. Es lo que ve un fork sin secrets.

## Modelo de seguridad

El endpoint del flow es **público y sin autenticación** — tiene que serlo, lo llama el navegador
de un visitante anónimo.

- `VITE_POWER_AUTOMATE_URL` y `VITE_TACKER_KEY` **se inlinean en el bundle** y cualquiera los
  lee con DevTools. Son secrets de GitHub sólo para no tenerlos en el código fuente, no para
  ocultarlos del usuario final.
- `x-tacker-key` es un **badén contra bots**, no autenticación. La validación real ocurre en el
  flow (Condition → 401 → Terminate).
- Nunca pongas un secreto real (password de SP, client secret, token de Outlook) en una variable
  `VITE_*`. Esos viven sólo en las conexiones del flow, que corren server-side.
- La pantalla de éxito **no muestra el mail interno de notificación** a propósito: filtrar a quién
  se le avisa expone estructura de personal a un visitante anónimo.

Postura honesta: **herramienta interna con URL pública**, protegida por oscuridad y bajo valor
para un atacante. Si aparece abuso real, el siguiente paso es un proxy (Cloudflare Worker /
Azure API Management) con rate limiting, no un CAPTCHA.

## Decisiones y supuestos

- **Detalle de la observación**: el formulario original sólo lista *Estado* y *Fecha de
  cumplimiento*. Se agregó un campo **Detalle** obligatorio porque una observación sin texto no
  es accionable. Se archiva en `Título`/`Comentarios` de la lista hija.
- **Nombre en las firmas**: el original pide firma + fecha. Se agregó **Nombre** obligatorio para
  poder identificar al firmante en SharePoint.
- **Evidencia en "MAL"**: se exige la **foto**; el comentario queda opcional (el original sólo
  menciona evidencia).
- **Estado general**: derivado, no cargado a mano. `OBSERVADO` si hay al menos un "MAL", si no `OK`.
- **Observaciones en la lista hija**: van como filas con `Tipo = OBSERVACION` en la misma lista de
  ítems, para no crear una tercera lista. La cabecera además guarda un resumen en texto.
- **Fechas**: el payload y las columnas de SharePoint son **UTC**. Las fechas sin hora se mandan
  como mediodía UTC (`T12:00:00Z`) para que no se corran un día en Argentina (UTC-3). La
  localización a es-AR ocurre sólo en el PDF y en el mail.
- **Volumen por envío**: ~130 elementos hijos. El `Respuesta` del flow se devuelve antes de los
  loops, así que el usuario no lo espera.

## Notas técnicas

- **PDF y acentos**: se usa la fuente estándar de jsPDF (helvetica). Se verificó que codifica
  cp1252 correctamente (`ñ`→0xF1, `ó`→0xF3, `¿`→0xBF), así que los acentos del castellano salen
  bien sin embeber una TTF. `pdfSafe()` translitera lo que queda fuera de cp1252 (emojis,
  comillas tipográficas) para evitar cajas vacías.
- **Compresión de imágenes en dos capas**: al elegir el archivo y otra vez al armar el payload.
  `compressImage` es idempotente, la duplicación es a propósito.
- **Draft en localStorage**: se guarda solo y **sólo se borra tras un envío confirmado**. Si el
  POST falla, la carga queda intacta y el botón pasa a "Reintentar envío" reusando el mismo folio.
- **Perfil del inspector**: nombre/site/location persisten en una clave aparte que sobrevive al
  envío, con su propia versión.
- **Service worker**: auto-recarga al detectar un worker nuevo. Al tocar `sw.js` hay que
  **bumpear `CACHE`**, si no los usuarios con la PWA instalada siguen viendo el bundle viejo.
- **Bump de versión del draft**: ante cualquier cambio de shape (ítems removidos/renombrados),
  subir `STORAGE_KEY` en `draftStorage.ts` y agregar la clave vieja a `LEGACY_KEYS`.

## Testing

No hay tests automatizados. `npm run lint` es `tsc --noEmit`: prueba que compila, **no** que
funciona. Lo que realmente cubre regresiones es el smoke test end-to-end en un celular real
(paso 8). Si se agregan tests, los candidatos de mayor valor son las funciones puras:
`contarChecklist`, `derivarEstadoGeneral`, `generarFolio`, `pdfSafe`, `buildPayload`.

## Agregar un campo nuevo

1. Columna en SharePoint (o actualizar el script y re-correrlo)
2. `web-app/src/types.ts` → agregar al `InspeccionDraft`
3. `InspectionForm.tsx` → control ligado, **siempre con `setDraft(prev => ...)`**
4. `uploadInspeccion.ts` → agregar a `buildPayload()`
5. Flujo → campo en `CreateHeaderItem` con `fx` y el wrapper que corresponda al tipo
6. Re-exportar el `.zip` del flujo y commitearlo
7. Probar un envío y verificar que la columna se llene

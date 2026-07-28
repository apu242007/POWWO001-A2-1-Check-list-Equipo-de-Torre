# Flow · Check List Equipo de Torre (POWWO001-A2-1 REV2)

Power Automate no tiene formato fuente versionable, así que el diseño del flujo vive acá.
Armalo en `make.powerautomate.com` siguiendo **exactamente** este documento, y cuando termines
exportá el paquete (`Exportar → Paquete (.zip)`) y commiteá el zip en esta misma carpeta.

## Placeholders

| Placeholder | Valor |
| --- | --- |
| `<SITE_URL>` | `https://tackersrl505.sharepoint.com/sites/TODOTACKER480` |
| `<HEADER_LIST>` | `Check List Equipo de Torre` — GUID `c1a4fdf9-4c55-4e51-a5d9-023268d11a4f` |
| `<CHILD_LIST>` | `CheckListEquipodeTorre Items` — GUID `8f96f01c-2008-467e-b9b7-aae30d5c79a5` |
| `<NOTIFY_EMAIL>` | `jcastro@tackertools.com` |
| `<TACKER_KEY>` | El mismo valor que se guarda en el secret `VITE_TACKER_KEY` |

> **Estado de SharePoint: ya está listo.** Las 40 columnas y la lookup `Inspeccion`
> están creadas y verificadas con un round-trip REST (acentos, Choices, fechas,
> booleano, adjunto binario y lookup). Sólo falta armar este flujo.
>
> La columna `Título` quedó renombrada a **`Folio`** en la cabecera y a **`Ítem`** en
> la lista hija. El InternalName sigue siendo `Title` en ambas — las expresiones no
> cambian, sólo la etiqueta que ves en el formulario de Power Automate.

## Árbol final

```text
When a HTTP request is received
├─ Check_key                   ← puerta 401 opcional
├─ Init_varFolio
├─ CreateHeaderItem            ← SharePoint · Create item (lista cabecera)
├─ Respuesta                   ← 200 ACÁ, antes de los loops
├─ Loop_attachments            (Concurrencia = 1)
│   └─ Add_attachment
├─ Loop_checklist              (Concurrencia = 20)
│   └─ Create_item_Child
└─ Send_email_V2               (run after = sólo "es correcto")
```

---

## 1) Trigger — `Cuando se recibe una solicitud HTTP`

| Campo | Valor |
| --- | --- |
| ¿Quién puede desencadenar el flujo? | **Cualquier persona** |
| Método (opciones avanzadas) | `POST` |
| Esquema JSON del cuerpo de la solicitud | **VACÍO — dejalo en blanco** |

El esquema vacío es deliberado: la SPA es la fuente de verdad del payload y un esquema
desactualizado rompe el guardado con *"'campo' ya no está presente en el esquema de la operación"*.
Perdés los chips de contenido dinámico, pero **todas las expresiones se escriben con `fx`** igual.

Después de guardar aparece la URL bajo el encabezado del trigger → **Copiar URL**.

---

## 2) `Check_key` — Condición (opcional, anti-bot)

Primera acción después del trigger.

- Izquierda (`fx`): `triggerOutputs()?['headers']?['x-tacker-key']`
- Operador: `es igual a`
- Derecha: `<TACKER_KEY>`

Rama **Si no**:

1. `Response` → Status Code `401`, Body `{"error":"unauthorized"}`
2. `Terminate` → Status `Failed`

Rama **En caso afirmativo**: vacía (el flujo sigue con las acciones de abajo).

> Esto **no es autenticación**. `VITE_TACKER_KEY` viaja en el bundle público y cualquiera
> puede leerlo con DevTools. Es un badén contra bots casuales, nada más.

---

## 3) `Init_varFolio` — Inicializar variable

| Campo | Valor |
| --- | --- |
| Nombre | `varFolio` |
| Tipo | `Cadena` |
| Valor (`fx`) | `if(empty(triggerBody()?['folio']), concat('ET-', formatDateTime(utcNow(),'yyyyMMdd-HHmmss')), triggerBody()?['folio'])` |

---

## 4) `CreateHeaderItem` — SharePoint · Crear elemento

### ⚠️ Renombrá la acción ANTES de escribir cualquier expresión

Este es el error más común al armar este flujo:

> *"Corrija esto para incluir una referencia válida a `CreateHeaderItem` para los parámetros de
> entrada de la acción `Respuesta` / `Agregar_datos_adjuntos` / `Crear_elemento`."*

Power Automate no resuelve las expresiones por el nombre que ves, sino por el **nombre interno**
de la acción, que se deriva del nombre visible: espacios → `_`, acentos removidos. Una acción
recién agregada se llama `Crear elemento` → id interno `Crear_elemento`. Si escribís
`outputs('CreateHeaderItem')` cuando la acción todavía se llama así, no existe y el diseñador
se queja en las **tres** acciones que la referencian.

Pasos, en este orden:

1. Click en la acción de SharePoint que crea el item de la **cabecera**
2. `⋯` → **Cambiar nombre**
3. Escribir exactamente `CreateHeaderItem` — sin espacios, sin acentos, respetando mayúsculas
4. **Recién ahora** cargar las expresiones de los pasos 5, 6 y 7

Si preferís no renombrar, usá el nombre interno real en las tres expresiones
(`outputs('Crear_elemento')?['body/ID']`). No lo recomiendo: hay **dos** acciones "Crear
elemento" en este flujo (cabecera e hija), la segunda queda como `Crear_elemento_2` y cualquier
reordenamiento posterior rompe las referencias en silencio.

Renombrar después de haber escrito las expresiones tampoco arregla solo: hay que volver a entrar
a cada una de las tres y re-pegar la expresión.

### Campos

- Dirección del sitio: `<SITE_URL>`
- Nombre de la lista: `<HEADER_LIST>`

Todos los campos van por la pestaña **`fx` Expresión** — nunca arrastres chips del panel de
contenido dinámico.

| Columna SP | Tipo | Expresión `fx` |
| --- | --- | --- |
| `Folio` (internal `Title`) | Text | `variables('varFolio')` |
| `Site conducted` | Text | `triggerBody()?['siteConducted']` |
| `Conducted on` | DateTime | `coalesce(triggerBody()?['conductedOn'], utcNow())` |
| `Confeccionado por` | Text | `triggerBody()?['preparedBy']` |
| `Location` | Text | `triggerBody()?['location']` |
| `Fundación` | Text | `triggerBody()?['secFundacion']` |
| `Herramientas de mano` | Text | `triggerBody()?['secHerramientasMano']` |
| `Condición de trabajo mástil` | Text | `triggerBody()?['secCondicionMastil']` |
| `Mástil - Torre` | Text | `triggerBody()?['secMastilTorre']` |
| `Condiciones llave de potencia` | Text | `triggerBody()?['secLlavePotencia']` |
| `Conjunto del pozo / aparejo` | Text | `triggerBody()?['secConjuntoPozo']` |
| `Sistema de circulación / lodo` | Text | `triggerBody()?['secSistemaCirculacion']` |
| `Vehículos` | Text | `triggerBody()?['secVehiculos']` |
| `Casilla de personal` | Text | `triggerBody()?['secCasillaPersonal']` |
| `Camión de transporte` | Text | `triggerBody()?['secCamionTransporte']` |
| `Estación de operación / piso` | Text | `triggerBody()?['secEstacionOperacion']` |
| `Equipamiento control del pozo` | Text | `triggerBody()?['secEquipamientoPozo']` |
| `Safety Equipment` | Text | `triggerBody()?['secSafetyEquipment']` |
| `Annex` | Text | `triggerBody()?['secAnnex']` |
| `Estado general` **Value** | Choice | `coalesce(triggerBody()?['estadoGeneral'], 'OK')` |
| `Total ítems respondidos` | Number | `if(equals(triggerBody()?['totalItems'], null), null, float(triggerBody()?['totalItems']))` |
| `Total BIEN` | Number | `if(equals(triggerBody()?['totalBien'], null), null, float(triggerBody()?['totalBien']))` |
| `Total MAL` | Number | `if(equals(triggerBody()?['totalMal'], null), null, float(triggerBody()?['totalMal']))` |
| `Total N/A` | Number | `if(equals(triggerBody()?['totalNa'], null), null, float(triggerBody()?['totalNa']))` |
| `Observaciones relevantes` | Note | `triggerBody()?['observacionesResumen']` |
| `Jefe de Equipo` | Text | `triggerBody()?['jefeEquipoNombre']` |
| `Fecha Jefe de Equipo` | DateOnly | `if(empty(triggerBody()?['jefeEquipoFecha']), null, triggerBody()?['jefeEquipoFecha'])` |
| `Técnico HSE` | Text | `triggerBody()?['tecnicoHseNombre']` |
| `Fecha Técnico HSE` | DateOnly | `if(empty(triggerBody()?['tecnicoHseFecha']), null, triggerBody()?['tecnicoHseFecha'])` |
| `Inspección Cliente` | Text | `triggerBody()?['clienteNombre']` |
| `Fecha Inspección Cliente` | DateOnly | `if(empty(triggerBody()?['clienteFecha']), null, triggerBody()?['clienteFecha'])` |
| `Declaración aceptada` | Boolean | `if(equals(triggerBody()?['declaracionAceptada'], null), false, bool(triggerBody()?['declaracionAceptada']))` |
| `Latitud` | Number | `if(equals(triggerBody()?['latitud'], null), null, float(triggerBody()?['latitud']))` |
| `Longitud` | Number | `if(equals(triggerBody()?['longitud'], null), null, float(triggerBody()?['longitud']))` |

Por qué los wrappers:

- **Choice**: `coalesce()` devuelve string, nunca `null` — sirve cuando hay default. Para un
  Choice opcional que puede venir vacío usá `if(empty(...), null, ...)`; el conector rechaza `""`.
- **Number**: el `float()` explícito evita que `""` se convierta en `0` silenciosamente.
- **DateTime opcional**: sin el `if(empty(...))` un string vacío revienta el Create item entero.

> Si aparece una columna **Persona o grupo** en el formulario, borrala de la lista: un flujo
> público anónimo no puede completarla.

---

## 5) `Respuesta` — Response · **antes de los loops**

Devolver el 200 acá hace que la SPA reciba respuesta en ~3 s en lugar de esperar los
~130 creates de SharePoint. Sin esto el gateway corta a los 110 s y el navegador ve un
HTTP 502 aunque el flujo después termine bien.

| Campo | Valor |
| --- | --- |
| Código de estado | `200` |
| Encabezados | `Content-Type` : `application/json` |
| Cuerpo (`fx`) | `{ "id": @{outputs('CreateHeaderItem')?['body/ID']}, "folio": "@{variables('varFolio')}" }` |

> No devuelvas una URL armada a mano de SharePoint: el slug de la lista casi nunca coincide
> con el Título y el botón "Ver en SharePoint" termina en un 404. La SPA a propósito no
> muestra link.

---

## 6) `Loop_attachments` — Aplicar a cada uno + Agregar datos adjuntos

| Campo | Valor |
| --- | --- |
| Seleccione una salida (`fx`) | `triggerBody()?['attachments']` |
| Configuración ⚙️ → Control de simultaneidad | **ACTIVADO · Grado de paralelismo = 1** |

⚠️ Concurrencia = 1 es **obligatorio**. Todas las iteraciones escriben sobre el *mismo* item de
SharePoint y en paralelo tiran `Save Conflict` de forma intermitente.

Dentro del loop — **Agregar datos adjuntos** (SharePoint):

| Campo | Valor |
| --- | --- |
| Dirección del sitio | `<SITE_URL>` |
| Nombre de la lista | `<HEADER_LIST>` |
| Id | `outputs('CreateHeaderItem')?['body/ID']` |
| Nombre del archivo (`fx`) | `items('Loop_attachments')?['name']` |
| Contenido del archivo (`fx`) | `base64ToBinary(items('Loop_attachments')?['contentBase64'])` |

**Verificá siempre en Vista de código** que el `body` de esta acción sea exactamente:

```json
"body": "@base64ToBinary(items('Loop_attachments')?['contentBase64'])"
```

Y **no**:

```json
"body": { "contentBytes": "...", "name": "..." }          ← el archivo queda con el JSON adentro
"body": "@base64ToBinary(...)\r\n"                        ← el \r\n final corrompe los bytes
```

Si el editor visual insiste en re-envolverlo, borrá la acción y agregala de nuevo cargando
cada campo desde la pestaña `fx` (nunca desde el selector de archivos).

Orden de `attachments` que manda la SPA:
`[0]` PDF del check list · `[1..3]` las tres firmas PNG · `[4..]` fotos de evidencia.

---

## 7) `Loop_checklist` — Aplicar a cada uno + Crear elemento (lista hija)

| Campo | Valor |
| --- | --- |
| Seleccione una salida (`fx`) | `triggerBody()?['checklist']` |
| Configuración ⚙️ → Control de simultaneidad | ACTIVADO · Grado de paralelismo = **20** |

Filas independientes → el paralelismo es seguro acá (a diferencia de los adjuntos).

Dentro del loop — **Crear elemento**, lista `<CHILD_LIST>`:

| Columna SP | Expresión `fx` |
| --- | --- |
| `Ítem` (internal `Title`) | `items('Loop_checklist')?['item']` |
| `Categoría` | `items('Loop_checklist')?['categoria']` |
| `Estado` **Value** | `if(empty(items('Loop_checklist')?['estado']), null, items('Loop_checklist')?['estado'])` |
| `Comentarios` | `items('Loop_checklist')?['comentarios']` |
| `Evidencia (archivo)` | `items('Loop_checklist')?['evidenciaURL']` |
| `Orden` | `if(equals(items('Loop_checklist')?['orden'], null), null, float(items('Loop_checklist')?['orden']))` |
| `Tipo` **Value** | `items('Loop_checklist')?['tipo']` |
| `Fecha de cumplimiento` | `if(empty(items('Loop_checklist')?['fechaCumplimiento']), null, items('Loop_checklist')?['fechaCumplimiento'])` |
| `Inspeccion Id` (Lookup) | `outputs('CreateHeaderItem')?['body/ID']` |

⚠️ La lookup se completa con el **ID** de la cabecera, nunca con el Título.

**Volumen**: el check list tiene 128 ítems, así que cada envío crea ~128–140 elementos hijos.
Con paralelismo 20 son unos 30–60 s de flujo — irrelevante para el usuario porque el `Respuesta`
ya se devolvió en el paso 5. Si el volumen molesta, la alternativa es que la SPA mande sólo
los ítems en `No` más las observaciones; hoy manda todo para tener trazabilidad completa.

---

## 8) `Send_email_V2` — Outlook, en la raíz del flujo

**Fuera de todo `Aplicar a cada uno`.** Adentro de un loop mandaría un mail por iteración.

`⋯` → **Configurar ejecución después** → dejar sólo `es correcto` (destildar `error`,
`se agotó el tiempo de espera`, `se ha omitido`) para `CreateHeaderItem`, `Loop_attachments`
y `Loop_checklist`. Si no, un fallo de SharePoint dispara igual un mail de "éxito".

| Campo | Valor |
| --- | --- |
| Para | `<NOTIFY_EMAIL>` |
| Asunto (`fx`) | ver abajo |
| Cuerpo | HTML, ver abajo |
| Opciones avanzadas → **Datos adjuntos** → `+ Agregar nuevo elemento` | |
| Nombre (`fx`) | `triggerBody()?['attachments']?[0]?['name']` |
| Contenido (`fx`) | `base64ToBinary(triggerBody()?['attachments']?[0]?['contentBase64'])` |

### Asunto

```text
concat(
  if(greater(coalesce(triggerBody()?['totalMal'], 0), 0), '⚠️ ', '✅ '),
  'Check List Equipo de Torre ', variables('varFolio'),
  ' — ', coalesce(triggerBody()?['siteConducted'], 's/d'),
  if(greater(coalesce(triggerBody()?['totalMal'], 0), 0),
     concat(' · ', string(triggerBody()?['totalMal']), ' desvío(s)'),
     '')
)
```

### Cuerpo (HTML)

```html
<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#212529">
  <h2 style="color:#0f2a44;margin:0 0 4px">Check List Equipo de Torre</h2>
  <div style="color:#6e7882;font-size:12px;margin-bottom:14px">POWWO001-A2-1 · REV2</div>

  @{if(greater(coalesce(triggerBody()?['totalMal'], 0), 0),
    concat(
      '<div style="background:#fee2e2;border-left:6px solid #b91c1c;padding:12px 14px;border-radius:6px;margin-bottom:14px">',
        '<div style="font-weight:700;color:#b91c1c">🔴 ', string(triggerBody()?['totalMal']),
        ' ítem(s) en MAL — requieren acción</div>',
        '<div style="font-size:12px;color:#7f1d1d;margin-top:4px">La evidencia fotográfica está adjunta al elemento de SharePoint.</div>',
      '</div>'),
    '<div style="background:#dcfce7;border-left:6px solid #15803d;padding:12px 14px;border-radius:6px;margin-bottom:14px;font-weight:700;color:#15803d">✅ Sin desvíos</div>'
  )}

  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px">
    <tr><td style="background:#f4f6f9;font-weight:600">Folio</td><td>@{variables('varFolio')}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Site conducted</td><td>@{triggerBody()?['siteConducted']}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Conducted on</td><td>@{convertTimeZone(coalesce(triggerBody()?['conductedOn'], utcNow()), 'UTC', 'Argentina Standard Time', 'dd/MM/yyyy HH:mm')}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Confeccionado por</td><td>@{triggerBody()?['preparedBy']}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Location</td><td>@{triggerBody()?['location']}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Estado general</td><td><b>@{triggerBody()?['estadoGeneral']}</b></td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">BIEN / MAL / N-A</td><td>@{triggerBody()?['totalBien']} / @{triggerBody()?['totalMal']} / @{triggerBody()?['totalNa']}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Jefe de Equipo</td><td>@{triggerBody()?['jefeEquipoNombre']}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Técnico HSE</td><td>@{triggerBody()?['tecnicoHseNombre']}</td></tr>
    <tr><td style="background:#f4f6f9;font-weight:600">Inspección Cliente</td><td>@{triggerBody()?['clienteNombre']}</td></tr>
  </table>

  @{if(empty(triggerBody()?['observacionesResumen']),
    '',
    concat('<h3 style="color:#0f2a44;margin:16px 0 6px">Observaciones relevantes</h3>',
           '<pre style="font-family:inherit;font-size:13px;white-space:pre-wrap;background:#f8fafc;border:1px solid #d5dae1;border-radius:6px;padding:10px">',
           triggerBody()?['observacionesResumen'], '</pre>'))}

  <p style="font-size:12px;color:#6e7882;margin-top:18px">
    El PDF completo va adjunto a este correo y también como archivo adjunto del elemento de SharePoint.
  </p>
</div>
```

`convertTimeZone(...)` es necesario: el payload y la columna de SharePoint viven en UTC, y una
fecha UTC cruda confunde a cualquiera que lea el mail desde Argentina.

---

## 9) Guardar, copiar URL, exportar

1. **Guardar** el flujo.
2. Click en el encabezado del trigger → **Copiar URL**.
3. Guardar esa URL como secret de GitHub `VITE_POWER_AUTOMATE_URL` en el repo.
4. Guardar el valor de `<TACKER_KEY>` como secret `VITE_TACKER_KEY`.
5. **Exportar → Paquete (.zip)** y commitear el zip en `power-automate/`.

---

## Checklist previo a guardar

- [ ] Esquema del trigger **vacío** (no "sincronizado": vacío)
- [ ] `varFolio` con fallback `concat('ET-', formatDateTime(utcNow(),'yyyyMMdd-HHmmss'))`
- [ ] La acción de crear la cabecera se **renombró a `CreateHeaderItem` ANTES** de escribir
      las expresiones que la referencian (si no: *"Corrija esto para incluir una referencia
      válida a CreateHeaderItem"* en `Respuesta`, `Agregar_datos_adjuntos` y `Crear_elemento`)
- [ ] Todos los campos cargados desde la pestaña `fx` (ningún chip naranja de contenido dinámico)
- [ ] `Respuesta` **entre** `CreateHeaderItem` y `Loop_attachments`
- [ ] `Loop_attachments` con simultaneidad **1**
- [ ] `body` de `Add_attachment` verificado en Vista de código, sin `\r\n` ni objeto JSON
- [ ] Lookup de la lista hija apuntando a `body/ID` de la cabecera, no al Título
- [ ] `Send_email_V2` en la raíz, con `Configurar ejecución después` = sólo `es correcto`
- [ ] URL del trigger guardada como secret `VITE_POWER_AUTOMATE_URL`
- [ ] Paquete `.zip` exportado y commiteado

## Diagnóstico rápido

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| `Corrija esto para incluir una referencia válida a 'CreateHeaderItem'…` (en `Respuesta`, `Agregar_datos_adjuntos` y `Crear_elemento`) | La acción de la cabecera no se llama `CreateHeaderItem`: su nombre interno sigue siendo `Crear_elemento`, así que `outputs('CreateHeaderItem')` apunta a algo inexistente | `⋯` → **Cambiar nombre** → `CreateHeaderItem`, y después re-pegar la expresión en las tres acciones (ver paso 4) |
| `Property selection is not supported on values of type 'String'` | La SPA mandó `Content-Type: text/plain` | Ya va `application/json`; si aparece, revisar proxies intermedios |
| `'secAnnex' ya no está presente en el esquema de la operación` | El trigger tiene un esquema JSON viejo | Vaciar el esquema y volver a pegar la expresión en la pestaña `fx` |
| `Missing Authorization header for a privileged call on connection` | Token del conector SharePoint/Outlook vencido | Power Automate → Conexiones → Reparar. No es un problema de código |
| HTTP 502 en el navegador | El flujo tardó > 110 s | Verificar que `Respuesta` esté **antes** de los loops |
| `Save Conflict` en `Add_attachment` | Simultaneidad del loop de adjuntos > 1 | Ponerla en 1 |
| Adjunto en SP con ícono de imagen rota | `body` con objeto JSON o `\r\n` al final | Vista de código → dejar sólo `@base64ToBinary(...)` |
| Columna Estado vacía en la lista hija | El valor no está entre los Choices de SP | Verificar que los choices sean `BIEN`, `MAL`, `N/A`, `Abierto`, `Cerrado` |
| Dos mails por envío | `Send_email_V2` adentro de un loop | Moverlo a la raíz |

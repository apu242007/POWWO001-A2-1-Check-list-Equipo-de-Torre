import {
  SECCIONES,
  contarChecklist,
  derivarEstadoGeneral,
} from "../types";
import type { InspeccionDraft } from "../types";
import {
  base64Bytes,
  blobToBase64,
  compressImage,
  dataUrlToBase64,
  dataUrlToBlob,
} from "../lib/imageUtils";
import { buildChecklistPdfAsync } from "../lib/pdfGenerator";

const POWER_AUTOMATE_URL = (import.meta.env.VITE_POWER_AUTOMATE_URL ?? "").trim();
const TACKER_KEY = (import.meta.env.VITE_TACKER_KEY ?? "").trim();

/** Sin URL de flow configurada la app corre en modo demo (no hace POST). */
export const isDemoMode = POWER_AUTOMATE_URL === "";

/** Tope defensivo del payload: por encima el flow suele morir por timeout del gateway. */
export const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;

export interface AttachmentPayload {
  name: string;
  contentBase64: string;
}

export interface ChecklistRowPayload {
  tipo: "ITEM" | "OBSERVACION";
  categoria: string;
  item: string;
  estado: string;
  comentarios: string;
  evidenciaURL: string;
  orden: number;
  fechaCumplimiento: string | null;
}

export interface InspeccionPayload {
  folio: string;
  siteConducted: string;
  conductedOn: string;
  preparedBy: string;
  location: string;

  secFundacion: string;
  secHerramientasMano: string;
  secCondicionMastil: string;
  secMastilTorre: string;
  secLlavePotencia: string;
  secConjuntoPozo: string;
  secSistemaCirculacion: string;
  secVehiculos: string;
  secCasillaPersonal: string;
  secCamionTransporte: string;
  secEstacionOperacion: string;
  secEquipamientoPozo: string;
  secSafetyEquipment: string;
  secAnnex: string;

  estadoGeneral: string;
  totalItems: number;
  totalSi: number;
  totalNo: number;
  totalNa: number;
  observacionesResumen: string;

  jefeEquipoNombre: string;
  jefeEquipoFecha: string | null;
  tecnicoHseNombre: string;
  tecnicoHseFecha: string | null;
  clienteNombre: string;
  clienteFecha: string | null;

  declaracionAceptada: boolean;
  latitud: number | null;
  longitud: number | null;

  checklist: ChecklistRowPayload[];
  attachments: AttachmentPayload[];
}

export interface UploadResult {
  ok: boolean;
  demo?: boolean;
  folio: string;
  id?: number;
  items: number;
  adjuntos: number;
  error?: string;
}

function limpio(s?: string): string {
  return (s ?? "").trim();
}

/** yyyy-MM-dd → ISO mediodía UTC (evita el corrimiento de día en zonas UTC-negativas). */
function fechaAIso(f?: string): string | null {
  const v = limpio(f);
  if (!v) return null;
  return `${v}T12:00:00Z`;
}

function extension(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .split("")
    .filter((c) => c.charCodeAt(0) < 128)
    .join("")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .toLowerCase();
}

/**
 * Construye las filas del check list + los adjuntos.
 * Convención de orden en `attachments`: [0] PDF, [1..3] firmas, [4..] evidencias.
 */
export async function buildPayload(
  draft: InspeccionDraft,
  folio: string,
): Promise<InspeccionPayload> {
  const conteo = contarChecklist(draft.respuestas);
  const estadoGeneral = derivarEstadoGeneral(conteo);

  const checklist: ChecklistRowPayload[] = [];
  const evidenciaAttachments: AttachmentPayload[] = [];
  let orden = 0;

  for (const sec of SECCIONES) {
    for (const it of sec.items) {
      orden += 1;
      const r = draft.respuestas[it.id];
      let evidenciaURL = "";

      const fuente: Blob | null =
        r?.evidencia ?? (r?.evidenciaDataUrl ? dataUrlToBlob(r.evidenciaDataUrl) : null);

      if (fuente) {
        // Capa 2 de compresión: red de seguridad si algo esquivó la del file picker.
        const comprimida = await compressImage(fuente);
        const name = `ev_${it.id}_${slug(it.texto)}_${folio}.${extension(comprimida.type)}`;
        evidenciaAttachments.push({ name, contentBase64: await blobToBase64(comprimida) });
        evidenciaURL = name;
      }

      checklist.push({
        tipo: "ITEM",
        categoria: sec.titulo,
        item: it.texto,
        estado: r?.estado ?? "",
        comentarios: limpio(r?.comentarios),
        evidenciaURL,
        orden,
        fechaCumplimiento: null,
      });
    }
  }

  for (const o of draft.observaciones) {
    orden += 1;
    checklist.push({
      tipo: "OBSERVACION",
      categoria: "Observaciones relevantes",
      item: limpio(o.detalle) || "(sin detalle)",
      estado: o.estado,
      comentarios: limpio(o.detalle),
      evidenciaURL: "",
      orden,
      fechaCumplimiento: fechaAIso(o.fechaCumplimiento),
    });
  }

  // PDF primero (el flow lo adjunta al email como attachments[0]).
  const pdfBlob = await buildChecklistPdfAsync({ draft, folio });
  const attachments: AttachmentPayload[] = [
    { name: `${folio}.pdf`, contentBase64: await blobToBase64(pdfBlob) },
  ];

  const firmas: [string, string | undefined][] = [
    ["jefe-equipo", draft.firmaJefeEquipo.firmaDataUrl],
    ["tecnico-hse", draft.firmaTecnicoHSE.firmaDataUrl],
    ["cliente", draft.firmaCliente.firmaDataUrl],
  ];
  for (const [rol, dataUrl] of firmas) {
    if (dataUrl && dataUrl.length > 200) {
      attachments.push({
        name: `firma-${rol}_${folio}.png`,
        contentBase64: dataUrlToBase64(dataUrl),
      });
    }
  }
  attachments.push(...evidenciaAttachments);

  const s = draft.secciones;
  const observacionesResumen = draft.observaciones
    .map(
      (o, i) =>
        `${i + 1}. [${o.estado}] ${limpio(o.detalle)}${
          o.fechaCumplimiento ? ` (cumplimiento: ${o.fechaCumplimiento})` : ""
        }`,
    )
    .join("\n");

  return {
    folio,
    siteConducted: limpio(draft.siteConducted),
    conductedOn: draft.conductedOn ?? new Date().toISOString(),
    preparedBy: limpio(draft.preparedBy),
    location: limpio(draft.location),

    secFundacion: limpio(s.fundacion),
    secHerramientasMano: limpio(s.herramientasMano),
    secCondicionMastil: limpio(s.condicionMastil),
    secMastilTorre: limpio(s.mastilTorre),
    secLlavePotencia: limpio(s.llavePotencia),
    secConjuntoPozo: limpio(s.conjuntoPozo),
    secSistemaCirculacion: limpio(s.sistemaCirculacion),
    secVehiculos: limpio(s.vehiculos),
    secCasillaPersonal: limpio(s.casillaPersonal),
    secCamionTransporte: limpio(s.camionTransporte),
    secEstacionOperacion: limpio(s.estacionOperacion),
    secEquipamientoPozo: limpio(s.equipamientoPozo),
    secSafetyEquipment: limpio(s.safetyEquipment),
    secAnnex: limpio(s.annex),

    estadoGeneral,
    totalItems: conteo.si + conteo.no + conteo.na,
    totalSi: conteo.si,
    totalNo: conteo.no,
    totalNa: conteo.na,
    observacionesResumen,

    jefeEquipoNombre: limpio(draft.firmaJefeEquipo.nombre),
    jefeEquipoFecha: fechaAIso(draft.firmaJefeEquipo.fecha),
    tecnicoHseNombre: limpio(draft.firmaTecnicoHSE.nombre),
    tecnicoHseFecha: fechaAIso(draft.firmaTecnicoHSE.fecha),
    clienteNombre: limpio(draft.firmaCliente.nombre),
    clienteFecha: fechaAIso(draft.firmaCliente.fecha),

    declaracionAceptada: draft.declaracionAceptada === true,
    latitud: typeof draft.latitud === "number" ? draft.latitud : null,
    longitud: typeof draft.longitud === "number" ? draft.longitud : null,

    checklist,
    attachments,
  };
}

export function pesoPayload(payload: InspeccionPayload): number {
  return payload.attachments.reduce((acc, a) => acc + base64Bytes(a.contentBase64), 0);
}

export async function uploadInspeccion(payload: InspeccionPayload): Promise<UploadResult> {
  const base = {
    folio: payload.folio,
    items: payload.checklist.length,
    adjuntos: payload.attachments.length,
  };

  if (isDemoMode) {
    console.warn("[demo] VITE_POWER_AUTOMATE_URL vacío — no se realiza el POST");
    return { ok: true, demo: true, ...base };
  }

  const peso = pesoPayload(payload);
  if (peso > MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      ...base,
      error: `El envío pesa ${(peso / 1024 / 1024).toFixed(1)} MB y supera el límite de ${(
        MAX_PAYLOAD_BYTES /
        1024 /
        1024
      ).toFixed(0)} MB. Reducí la cantidad de fotos de evidencia.`,
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (TACKER_KEY) headers["x-tacker-key"] = TACKER_KEY;

  try {
    const res = await fetch(POWER_AUTOMATE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return {
        ok: false,
        ...base,
        error: `HTTP ${res.status} ${res.statusText}. ${texto.slice(0, 300)}`.trim(),
      };
    }

    let id: number | undefined;
    try {
      const json = (await res.json()) as { id?: number };
      if (typeof json?.id === "number") id = json.id;
    } catch {
      /* el flow puede responder vacío; no es un error */
    }
    return { ok: true, id, ...base };
  } catch (e) {
    return {
      ok: false,
      ...base,
      error: `No se pudo contactar al servidor. Revisá la conexión y reintentá. (${
        e instanceof Error ? e.message : String(e)
      })`,
    };
  }
}

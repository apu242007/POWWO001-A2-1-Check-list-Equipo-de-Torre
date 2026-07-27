import type { InspeccionDraft, RespuestaItem } from "../types";
import { draftVacio } from "../types";

// Bumpear la versión ante CUALQUIER cambio de shape (ítems removidos, campos renombrados…).
const STORAGE_KEY = "tacker-eqtorre-draft-v1";
const STORAGE_TS_KEY = "tacker-eqtorre-draft-ts-v1";

const LEGACY_KEYS: string[] = [
  // Agregar acá las claves de versiones anteriores al bumpear.
];

function purgeLegacy(): void {
  for (const k of LEGACY_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* storage no disponible */
    }
  }
}

/** Los `File` no son serializables — se persiste sólo la dataURL de la evidencia. */
type RespuestaSerializable = Omit<RespuestaItem, "evidencia">;

interface DraftSerializable extends Omit<InspeccionDraft, "respuestas"> {
  respuestas: Record<string, RespuestaSerializable>;
}

export function loadDraft(): InspeccionDraft | null {
  purgeLegacy();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSerializable;
    if (!parsed || typeof parsed !== "object") return null;

    const base = draftVacio();
    const respuestas: Record<string, RespuestaItem> = {};
    for (const [id, r] of Object.entries(parsed.respuestas ?? {})) {
      respuestas[id] = { ...r, evidencia: null };
    }
    return {
      ...base,
      ...parsed,
      secciones: parsed.secciones ?? {},
      observaciones: Array.isArray(parsed.observaciones) ? parsed.observaciones : [],
      firmaJefeEquipo: parsed.firmaJefeEquipo ?? {},
      firmaTecnicoHSE: parsed.firmaTecnicoHSE ?? {},
      firmaCliente: parsed.firmaCliente ?? {},
      respuestas,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: InspeccionDraft): void {
  try {
    const respuestas: Record<string, RespuestaSerializable> = {};
    for (const [id, r] of Object.entries(draft.respuestas)) {
      const { evidencia: _evidencia, ...rest } = r;
      // Sólo persistimos entradas con contenido real.
      if (rest.estado || rest.comentarios || rest.evidenciaDataUrl) respuestas[id] = rest;
    }
    const payload: DraftSerializable = { ...draft, respuestas };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(STORAGE_TS_KEY, new Date().toISOString());
  } catch {
    // QuotaExceeded con muchas fotos: se pierde el autosave, no la sesión en curso.
  }
}

export function draftTimestamp(): string | null {
  try {
    return localStorage.getItem(STORAGE_TS_KEY);
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  purgeLegacy();
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
  } catch {
    /* noop */
  }
}

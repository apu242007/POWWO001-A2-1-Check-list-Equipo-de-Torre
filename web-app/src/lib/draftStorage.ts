import type { InspeccionDraft, RespuestaItem } from "../types";
import { draftVacio } from "../types";

// Bumpear la versión ante CUALQUIER cambio de shape (ítems removidos, campos renombrados…).
const STORAGE_KEY = "tacker-eqtorre-draft-v2";
const STORAGE_TS_KEY = "tacker-eqtorre-draft-ts-v2";

const LEGACY_KEYS: string[] = [
  // v1 guardaba estados "Sí"/"No"; ahora son "BIEN"/"MAL" y no hay migración posible.
  "tacker-eqtorre-draft-v1",
  "tacker-eqtorre-draft-ts-v1",
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

/**
 * ¿El borrador tiene trabajo real del usuario?
 * Los datos de cabecera NO cuentan: se pre-cargan desde el perfil del inspector,
 * así que un formulario recién abierto los trae solo. Sin este filtro el autosave
 * escribe un draft vacío y al recargar la app anuncia "se restauró un borrador"
 * cuando en realidad no hay nada que restaurar.
 */
export function draftTieneContenido(draft: InspeccionDraft): boolean {
  for (const r of Object.values(draft.respuestas)) {
    if (r?.estado || r?.comentarios?.trim() || r?.evidenciaDataUrl) return true;
  }
  if (draft.observaciones.length > 0) return true;
  if (Object.values(draft.secciones).some((v) => (v ?? "").trim() !== "")) return true;
  if (
    draft.firmaJefeEquipo.firmaDataUrl ||
    draft.firmaTecnicoHSE.firmaDataUrl ||
    draft.firmaCliente.firmaDataUrl
  ) {
    return true;
  }
  return draft.declaracionAceptada === true;
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
  if (!draftTieneContenido(draft)) {
    // Nada que guardar todavía; además limpiamos restos de una sesión anterior.
    clearDraft();
    return;
  }
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

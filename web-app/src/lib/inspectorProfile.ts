/**
 * Identidad del inspector — sobrevive al draft (que se limpia tras cada envío exitoso).
 * Versión independiente: cambiar el check list no debe borrar el perfil.
 */
const PROFILE_KEY = "tacker-eqtorre-perfil-v1";

export interface InspectorProfile {
  preparedBy?: string;
  siteConducted?: string;
  location?: string;
  jefeEquipoNombre?: string;
  tecnicoHSENombre?: string;
  clienteNombre?: string;
}

export function loadInspectorProfile(): InspectorProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as InspectorProfile;
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

export function saveInspectorProfile(p: InspectorProfile): void {
  try {
    const prev = loadInspectorProfile() ?? {};
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...prev, ...p }));
  } catch {
    /* noop */
  }
}

// POWWO001-A2-1 · Check List Equipo de Torre (REV2)
// Fuente de verdad del formulario: secciones, ítems y shape del draft.

export type EstadoItem = "BIEN" | "MAL" | "N/A";

export const ESTADOS_ITEM: EstadoItem[] = ["BIEN", "MAL", "N/A"];

/** Un "MAL" obliga a adjuntar evidencia fotográfica. */
export const ESTADO_REQUIERE_EVIDENCIA: EstadoItem = "MAL";

/** Equipos de la flota. Lista cerrada: el desplegable no admite valores nuevos. */
export const EQUIPOS = [
  "TKR-01",
  "TKR-05",
  "TKR-06",
  "TKR-07",
  "TKR-08",
  "TKR-10",
  "TKR-11",
] as const;

export type EstadoObservacion = "Abierto" | "Cerrado";
export const ESTADOS_OBSERVACION: EstadoObservacion[] = ["Abierto", "Cerrado"];

/** Clave del campo de texto libre que identifica cada sección. */
export type SeccionTextoKey =
  | "fundacion"
  | "herramientasMano"
  | "condicionMastil"
  | "mastilTorre"
  | "llavePotencia"
  | "conjuntoPozo"
  | "sistemaCirculacion"
  | "vehiculos"
  | "casillaPersonal"
  | "camionTransporte"
  | "estacionOperacion"
  | "equipamientoPozo"
  | "safetyEquipment"
  | "annex";

export interface ChecklistItemDef {
  id: string;
  texto: string;
}

export interface SeccionDef {
  id: string;
  titulo: string;
  /** Campo de texto libre que encabeza la sección (si la sección lo tiene). */
  campoTexto?: { key: SeccionTextoKey; label: string };
  items: ChecklistItemDef[];
}

// ---------------------------------------------------------------------------
// Catálogo del check list
// ---------------------------------------------------------------------------

export const SECCIONES: SeccionDef[] = [
  {
    id: "gen",
    titulo: "General",
    items: [
      { id: "gen-01", texto: "Distancia de la Línea de Potencia" },
      { id: "gen-02", texto: "Señales de Peligro desplegadas" },
      { id: "gen-03", texto: "Conjunto de Primeros Auxilios" },
      { id: "gen-04", texto: "Señalización de los Contravientos" },
      { id: "gen-05", texto: "Zona para descenso de la torre despejada" },
      { id: "gen-06", texto: "Vehículo fuera de la zona de Contravientos" },
      { id: "gen-07", texto: "Limpieza general" },
      { id: "gen-08", texto: "Cañería sobre caballetes" },
      { id: "gen-09", texto: "Riesgo de fuego controlados" },
    ],
  },
  {
    id: "cvt",
    titulo: "Contravientos",
    items: [
      { id: "cvt-01", texto: "Contravientos desde la corona" },
      { id: "cvt-02", texto: "Número de contravientos" },
      { id: "cvt-03", texto: "Condiciones de los contravientos" },
      { id: "cvt-04", texto: "Diámetro de los contravientos" },
      { id: "cvt-05", texto: "Tres grampas como mínimo" },
      { id: "cvt-06", texto: "Anclajes a tierra" },
      { id: "cvt-07", texto: "Contravientos del Piso de Enganche" },
      { id: "cvt-08", texto: "Estirado y cruzado para el piso" },
      { id: "cvt-09", texto: "Tres grampas mínimo (piso de enganche)" },
      { id: "cvt-10", texto: "Contravientos internos para tensión" },
    ],
  },
  {
    id: "fun",
    titulo: "Fundación",
    campoTexto: { key: "fundacion", label: "Fundación" },
    items: [{ id: "fun-01", texto: "Suplemento para apoyo adecuado provisto" }],
  },
  {
    id: "hdm",
    titulo: "Herramientas de mano",
    campoTexto: { key: "herramientasMano", label: "Herramientas de mano" },
    items: [
      { id: "hdm-01", texto: "Condición" },
      { id: "hdm-02", texto: "Limpieza" },
      { id: "hdm-03", texto: "Almacenamiento" },
    ],
  },
  {
    id: "ctm",
    titulo: "Condición de trabajo mástil",
    campoTexto: { key: "condicionMastil", label: "Condición de trabajo mástil" },
    items: [
      { id: "ctm-01", texto: "Protectores" },
      { id: "ctm-02", texto: "Líneas de tubing y stand pipe" },
      { id: "ctm-03", texto: "Cable de pistoneo" },
      {
        id: "ctm-04",
        texto: "Suficientes vueltas de cable de tambor cuando el aparejo se encuentra abajo",
      },
      { id: "ctm-05", texto: "Anclaje de línea muerta y retenedor" },
      { id: "ctm-06", texto: "Sistema de Frenado" },
      { id: "ctm-07", texto: "Superficie de fricción del carretel de maniobra" },
      { id: "ctm-08", texto: "Separador de línea de carretel abrazadera" },
      { id: "ctm-09", texto: "Cable de maniobra" },
      { id: "ctm-10", texto: "Frenos / Pare de Emergencia" },
      { id: "ctm-11", texto: "Traba de caja tractora para camino" },
      { id: "ctm-12", texto: "Manipulación del guinche. Señalización" },
    ],
  },
  {
    id: "mtt",
    titulo: "Mástil - Torre",
    campoTexto: { key: "mastilTorre", label: "Mástil - Torre" },
    items: [
      { id: "mtt-01", texto: "Especificaciones del fabricante / placa de operación" },
      { id: "mtt-02", texto: "Daños y corrosión excesiva" },
      { id: "mtt-03", texto: "Escalera" },
      { id: "mtt-04", texto: "Pasillo de piso de enganche" },
      { id: "mtt-05", texto: "Canasta de Varillas" },
      { id: "mtt-06", texto: "Corona" },
      { id: "mtt-07", texto: "Mecanismo de izaje del equipo" },
      { id: "mtt-08", texto: "Inspección visual de pasadores" },
      { id: "mtt-09", texto: "Brazos estabilizadores" },
      { id: "mtt-10", texto: "Protectores de poleas de la corona" },
      { id: "mtt-11", texto: "Cables de seguridad de los dientes del peine" },
      { id: "mtt-12", texto: "Fisuras o fallas de metal en puntos de articulación" },
      { id: "mtt-13", texto: "Pasadores de seguro de la torre en su lugar" },
      { id: "mtt-14", texto: "Los puntos de articulación tienen seguros" },
      { id: "mtt-15", texto: "Sistema hidráulico de la torre" },
      { id: "mtt-16", texto: "Sistema de iluminación" },
      { id: "mtt-17", texto: "Purgado de aire del sistema hidráulico cilindro izador" },
    ],
  },
  {
    id: "llp",
    titulo: "Herramientas y equipamiento · Condiciones de la llave de potencia",
    campoTexto: { key: "llavePotencia", label: "Condiciones de la llave de potencia" },
    items: [
      { id: "llp-01", texto: "Cierre de seguridad" },
      { id: "llp-02", texto: "Llave de contra" },
      { id: "llp-03", texto: "Línea de retenida. Brazo fijo" },
      { id: "llp-04", texto: "Cobertura de la válvula de control" },
      { id: "llp-05", texto: "Abrazaderas y conexiones" },
      { id: "llp-06", texto: "Posicionador de la pinza" },
    ],
  },
  {
    id: "cpa",
    titulo: "Condiciones del conjunto del pozo / aparejo",
    campoTexto: { key: "conjuntoPozo", label: "Condiciones del conjunto del pozo de aparejo" },
    items: [
      { id: "cpa-01", texto: "Aparejo y Gancho" },
      { id: "cpa-02", texto: "Protector de rondanas / Seguro" },
      { id: "cpa-03", texto: "Amelas / Eslabones" },
      { id: "cpa-04", texto: "Elevadores" },
      { id: "cpa-05", texto: "Perno de gancho" },
      { id: "cpa-06", texto: "Elevadores de transferencia" },
    ],
  },
  {
    id: "scl",
    titulo: "Sistema de circulación / lodo",
    campoTexto: { key: "sistemaCirculacion", label: "Sistema de circulación / lodo" },
    items: [
      { id: "scl-01", texto: "Caño de elevación de lodo firme y asegurado" },
      {
        id: "scl-02",
        texto:
          "Manguera de inyección cuello de cisne y cabeza de inyección con cadenas de seguridad",
      },
      { id: "scl-03", texto: "Accesorios de alta presión" },
    ],
  },
  {
    id: "veh",
    titulo: "Vehículos",
    campoTexto: { key: "vehiculos", label: "Vehículos" },
    items: [
      { id: "veh-01", texto: "Vidrios y espejos" },
      { id: "veh-02", texto: "Neumáticos, luces y realce" },
      { id: "veh-03", texto: "Mantenimiento de cabina" },
    ],
  },
  {
    id: "cas",
    titulo: "Casilla de personal",
    campoTexto: { key: "casillaPersonal", label: "Casilla de personal" },
    items: [
      { id: "cas-01", texto: "Mantenimiento y limpieza" },
      { id: "cas-02", texto: "Condiciones de la estufa" },
      { id: "cas-03", texto: "Instalación eléctrica" },
      { id: "cas-04", texto: "Luces" },
      { id: "cas-05", texto: "Enganche y cadena de seguridad" },
      { id: "cas-06", texto: "Aseguramiento para izaje con petrolero" },
      { id: "cas-07", texto: "Vestuario" },
      { id: "cas-08", texto: "Baños" },
      { id: "cas-09", texto: "Cocina" },
      { id: "cas-10", texto: "Oficina" },
    ],
  },
  {
    id: "cam",
    titulo: "Camión de transporte",
    campoTexto: { key: "camionTransporte", label: "Camión de transporte" },
    items: [
      { id: "cam-01", texto: "Barandas" },
      { id: "cam-02", texto: "Escalones" },
      { id: "cam-03", texto: "Luces delanteras" },
      { id: "cam-04", texto: "Luces traseras" },
      { id: "cam-05", texto: "Ruedas acuñadas" },
      { id: "cam-06", texto: "Condición de llantas" },
      { id: "cam-07", texto: "Neumáticos" },
      { id: "cam-08", texto: "Tanque de combustible rotulado" },
      { id: "cam-09", texto: "Pérdida de combustible" },
      { id: "cam-10", texto: "Materiales sueltos e inflamables en cabina" },
      { id: "cam-11", texto: "Vidrios y espejo" },
      { id: "cam-12", texto: "Limpiaparabrisas" },
      { id: "cam-13", texto: "Equipamiento de emergencia" },
      { id: "cam-14", texto: "Gatos hidráulicos asegurados" },
    ],
  },
  {
    id: "eop",
    titulo: "Estación de operación / plataforma de trabajo / piso",
    campoTexto: {
      key: "estacionOperacion",
      label: "Estación de operación plataforma de trabajo piso",
    },
    items: [
      { id: "eop-01", texto: "Todos los controles rotulados" },
      { id: "eop-02", texto: "Piso de trabajo" },
      { id: "eop-03", texto: "Escalones y barandas" },
      { id: "eop-04", texto: "Válvula de seguridad para alivio de presión" },
      { id: "eop-05", texto: "Líneas de descarga ancladas" },
      { id: "eop-06", texto: "Protecciones de la bomba" },
      { id: "eop-07", texto: "Pasillos y escaleras de la pileta" },
      { id: "eop-08", texto: "Área de mezcla de lodo" },
    ],
  },
  {
    id: "ecp",
    titulo: "Equipamiento para control del pozo",
    campoTexto: { key: "equipamientoPozo", label: "Equipamiento para control del pozo" },
    items: [
      { id: "ecp-01", texto: "BOP instalada, probada y funcionando" },
      { id: "ecp-02", texto: "Entrenamiento sobre su uso" },
    ],
  },
  {
    id: "saf",
    titulo: "Safety Equipment",
    campoTexto: { key: "safetyEquipment", label: "Safety Equipment" },
    items: [
      { id: "saf-01", texto: "Arnés y puntos de anclaje" },
      { id: "saf-02", texto: "Sistema de ascenso en escalera" },
      { id: "saf-03", texto: "Equipo de escape de emergencia" },
      { id: "saf-04", texto: "Extintores portátiles" },
      { id: "saf-05", texto: "Equipos de protección personal" },
    ],
  },
  {
    id: "anx",
    titulo: "Annex",
    campoTexto: { key: "annex", label: "Annex" },
    items: [
      { id: "anx-01", texto: "Rig stroke limiter" },
      { id: "anx-02", texto: "Flame arrestors" },
      { id: "anx-03", texto: "Grounding" },
      { id: "anx-04", texto: "Usina: Llave de Corte General" },
      { id: "anx-05", texto: "Usina: Piso aislante" },
      { id: "anx-06", texto: "Instalación eléctrica de usina" },
      { id: "anx-07", texto: "Luz de emergencia" },
      { id: "anx-08", texto: "BOP Remote Control" },
      { id: "anx-09", texto: "Fast Disconnect" },
      { id: "anx-10", texto: "Casilla: Toilets" },
      { id: "anx-11", texto: "Casilla: Drinking Water" },
      { id: "anx-12", texto: "Recipiente para residuos" },
      { id: "anx-13", texto: "Laboratory" },
      { id: "anx-14", texto: "Instruments" },
      { id: "anx-15", texto: "Communication System" },
      { id: "anx-16", texto: "Cartelera de objetivos" },
      { id: "anx-17", texto: "Foam Equipment with Fire" },
      { id: "anx-18", texto: "Caballetes / planchada" },
      { id: "anx-19", texto: "Cartel de presentación" },
    ],
  },
];

/** Índice plano id → { seccion, item, orden } para lookups O(1). */
export const ITEM_INDEX: Record<
  string,
  { seccionId: string; seccionTitulo: string; texto: string; orden: number }
> = (() => {
  const idx: Record<
    string,
    { seccionId: string; seccionTitulo: string; texto: string; orden: number }
  > = {};
  let orden = 0;
  for (const s of SECCIONES) {
    for (const it of s.items) {
      orden += 1;
      idx[it.id] = {
        seccionId: s.id,
        seccionTitulo: s.titulo,
        texto: it.texto,
        orden,
      };
    }
  }
  return idx;
})();

export const TOTAL_ITEMS = Object.keys(ITEM_INDEX).length;

// ---------------------------------------------------------------------------
// Estado del formulario
// ---------------------------------------------------------------------------

export interface RespuestaItem {
  estado?: EstadoItem;
  comentarios?: string;
  /** Foto de evidencia. Obligatoria cuando estado === "MAL". */
  evidencia?: File | null;
  /** dataURL persistida en el draft (para sobrevivir un refresh). */
  evidenciaDataUrl?: string;
}

export interface Observacion {
  id: string;
  detalle: string;
  estado: EstadoObservacion;
  /** yyyy-MM-dd */
  fechaCumplimiento?: string;
}

export interface FirmaBloque {
  nombre?: string;
  firmaDataUrl?: string;
  /** yyyy-MM-dd */
  fecha?: string;
}

export type SeccionesTexto = Partial<Record<SeccionTextoKey, string>>;

export interface InspeccionDraft {
  folio?: string;

  // 1 · Datos generales
  siteConducted?: string;
  /** ISO-8601 UTC. */
  conductedOn?: string;
  preparedBy?: string;
  location?: string;

  // Campos de texto por sección
  secciones: SeccionesTexto;

  // Respuestas del check list
  respuestas: Record<string, RespuestaItem>;

  // 18 · Observaciones relevantes (repetibles)
  observaciones: Observacion[];

  // 19 · Firmas
  firmaJefeEquipo: FirmaBloque;
  firmaTecnicoHSE: FirmaBloque;
  firmaCliente: FirmaBloque;

  // 20 · Declaración final
  declaracionAceptada?: boolean;

  // GPS opcional
  latitud?: number;
  longitud?: number;
}

export function draftVacio(): InspeccionDraft {
  return {
    conductedOn: new Date().toISOString(),
    secciones: {},
    respuestas: {},
    observaciones: [],
    firmaJefeEquipo: {},
    firmaTecnicoHSE: {},
    firmaCliente: {},
    declaracionAceptada: false,
  };
}

export const TEXTO_DECLARACION =
  "Declaro que realicé personalmente esta inspección, que verifiqué todos los elementos " +
  "listados, que la información volcada refleja el estado real del equipo al momento de la " +
  "inspección y que no omití desvíos detectados. Acepto la responsabilidad que me corresponde " +
  "por información falsa u omisiones.";

// ---------------------------------------------------------------------------
// Derivaciones
// ---------------------------------------------------------------------------

export interface ConteoChecklist {
  bien: number;
  mal: number;
  na: number;
  sinResponder: number;
  /** ids con estado "MAL" y sin foto de evidencia. */
  sinEvidencia: string[];
}

export function contarChecklist(respuestas: Record<string, RespuestaItem>): ConteoChecklist {
  let bien = 0;
  let mal = 0;
  let na = 0;
  let sinResponder = 0;
  const sinEvidencia: string[] = [];

  for (const id of Object.keys(ITEM_INDEX)) {
    const r = respuestas[id];
    if (!r?.estado) {
      sinResponder += 1;
      continue;
    }
    if (r.estado === "BIEN") bien += 1;
    else if (r.estado === "N/A") na += 1;
    else {
      mal += 1;
      if (!r.evidencia && !r.evidenciaDataUrl) sinEvidencia.push(id);
    }
  }
  return { bien, mal, na, sinResponder, sinEvidencia };
}

export type EstadoGeneral = "OK" | "OBSERVADO";

export function derivarEstadoGeneral(conteo: ConteoChecklist): EstadoGeneral {
  return conteo.mal > 0 ? "OBSERVADO" : "OK";
}

/** Folio: ET-YYYYMMDD-NNNN (NNNN aleatorio, estable durante toda la carga). */
export function generarFolio(d: Date = new Date()): string {
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  const fecha = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const n = Math.floor(1000 + Math.random() * 9000);
  return `ET-${fecha}-${n}`;
}

export function hoyISOFecha(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatFechaAR(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(iso.length === 10 ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

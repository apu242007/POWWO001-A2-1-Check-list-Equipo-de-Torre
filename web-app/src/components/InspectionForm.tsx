import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SignaturePad from "./SignaturePad";
import {
  EQUIPOS,
  ESTADOS_ITEM,
  ESTADOS_OBSERVACION,
  ITEM_INDEX,
  SECCIONES,
  TEXTO_DECLARACION,
  TOTAL_ITEMS,
  contarChecklist,
  derivarEstadoGeneral,
  draftVacio,
  generarFolio,
  hoyISOFecha,
} from "../types";
import type {
  EstadoItem,
  EstadoObservacion,
  FirmaBloque,
  InspeccionDraft,
  Observacion,
  SeccionDef,
  SeccionTextoKey,
} from "../types";
import {
  clearDraft,
  draftTieneContenido,
  draftTimestamp,
  loadDraft,
  saveDraft,
} from "../lib/draftStorage";
import { loadInspectorProfile, saveInspectorProfile } from "../lib/inspectorProfile";
import { blobToDataUrl, compressToFile } from "../lib/imageUtils";
import { buildChecklistPdfAsync } from "../lib/pdfGenerator";
import {
  MAX_PAYLOAD_BYTES,
  buildPayload,
  isDemoMode,
  pesoPayload,
  uploadInspeccion,
} from "../services/uploadInspeccion";
import type { InspeccionPayload, UploadResult } from "../services/uploadInspeccion";

type FirmaKey = "firmaJefeEquipo" | "firmaTecnicoHSE" | "firmaCliente";

const FIRMAS: { key: FirmaKey; rol: string }[] = [
  { key: "firmaJefeEquipo", rol: "Jefe de Equipo" },
  { key: "firmaTecnicoHSE", rol: "Técnico HSE" },
  { key: "firmaCliente", rol: "Inspección Cliente" },
];

/** `datetime-local` trabaja en hora local; el draft guarda ISO UTC. */
function isoALocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

function localInputAIso(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function nuevoIdObservacion(): string {
  return `obs-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default function InspectionForm() {
  const [draft, setDraft] = useState<InspeccionDraft>(() => draftVacio());
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});
  const [restaurado, setRestaurado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [gpsEstado, setGpsEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<UploadResult | null>(null);
  const enVueloRef = useRef(false);

  // ---------------- Carga inicial: draft + perfil ----------------
  useEffect(() => {
    const guardado = loadDraft();
    if (guardado && draftTieneContenido(guardado)) {
      setDraft({ ...guardado, folio: guardado.folio ?? generarFolio() });
      setRestaurado(draftTimestamp());
      return;
    }
    const perfil = loadInspectorProfile();
    setDraft((d) => ({
      ...d,
      folio: generarFolio(),
      preparedBy: perfil?.preparedBy ?? "",
      siteConducted: perfil?.siteConducted ?? "",
      location: perfil?.location ?? "",
      firmaJefeEquipo: { nombre: perfil?.jefeEquipoNombre ?? "", fecha: hoyISOFecha() },
      firmaTecnicoHSE: { nombre: perfil?.tecnicoHSENombre ?? "", fecha: hoyISOFecha() },
      firmaCliente: { nombre: perfil?.clienteNombre ?? "", fecha: hoyISOFecha() },
    }));
  }, []);

  // ---------------- Autosave ----------------
  useEffect(() => {
    if (exito) return;
    const t = setTimeout(() => saveDraft(draft), 500);
    return () => clearTimeout(t);
  }, [draft, exito]);

  const conteo = useMemo(() => contarChecklist(draft.respuestas), [draft.respuestas]);
  const estadoGeneral = derivarEstadoGeneral(conteo);
  const respondidos = conteo.bien + conteo.mal + conteo.na;

  // ---------------- Mutadores (siempre funcionales) ----------------
  const setCampo = useCallback(<K extends keyof InspeccionDraft>(k: K, v: InspeccionDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  }, []);

  const setSeccionTexto = useCallback((key: SeccionTextoKey, v: string) => {
    setDraft((d) => ({ ...d, secciones: { ...d.secciones, [key]: v } }));
  }, []);

  const setEstado = useCallback((itemId: string, estado: EstadoItem) => {
    setDraft((d) => {
      const prev = d.respuestas[itemId] ?? {};
      // Pasar a BIEN o N/A descarta la evidencia: ya no aplica.
      const limpiar = estado !== "MAL";
      return {
        ...d,
        respuestas: {
          ...d.respuestas,
          [itemId]: {
            ...prev,
            estado,
            ...(limpiar ? { evidencia: null, evidenciaDataUrl: undefined } : {}),
          },
        },
      };
    });
  }, []);

  const setComentario = useCallback((itemId: string, v: string) => {
    setDraft((d) => ({
      ...d,
      respuestas: { ...d.respuestas, [itemId]: { ...(d.respuestas[itemId] ?? {}), comentarios: v } },
    }));
  }, []);

  const setEvidencia = useCallback(async (itemId: string, file: File | null) => {
    if (!file) {
      setDraft((d) => ({
        ...d,
        respuestas: {
          ...d.respuestas,
          [itemId]: { ...(d.respuestas[itemId] ?? {}), evidencia: null, evidenciaDataUrl: undefined },
        },
      }));
      return;
    }
    // Capa 1 de compresión: la foto entra al estado ya reducida.
    const comprimida = await compressToFile(file, `ev_${itemId}`);
    const dataUrl = await blobToDataUrl(comprimida);
    setDraft((d) => ({
      ...d,
      respuestas: {
        ...d.respuestas,
        [itemId]: {
          ...(d.respuestas[itemId] ?? {}),
          evidencia: comprimida,
          evidenciaDataUrl: dataUrl,
        },
      },
    }));
  }, []);

  const setFirma = useCallback((key: FirmaKey, patch: Partial<FirmaBloque>) => {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }, []);

  const marcarSeccion = useCallback((sec: SeccionDef, estado: EstadoItem) => {
    setDraft((d) => {
      const respuestas = { ...d.respuestas };
      for (const it of sec.items) {
        const prev = respuestas[it.id] ?? {};
        if (prev.estado) continue; // no pisa respuestas ya cargadas
        respuestas[it.id] = { ...prev, estado };
      }
      return { ...d, respuestas };
    });
  }, []);

  // ---------------- Observaciones ----------------
  const agregarObservacion = useCallback(() => {
    setDraft((d) => ({
      ...d,
      observaciones: [
        ...d.observaciones,
        { id: nuevoIdObservacion(), detalle: "", estado: "Abierto" as EstadoObservacion },
      ],
    }));
  }, []);

  const actualizarObservacion = useCallback((id: string, patch: Partial<Observacion>) => {
    setDraft((d) => ({
      ...d,
      observaciones: d.observaciones.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }, []);

  const eliminarObservacion = useCallback((id: string) => {
    setDraft((d) => ({ ...d, observaciones: d.observaciones.filter((o) => o.id !== id) }));
  }, []);

  // ---------------- GPS ----------------
  function capturarGps() {
    setGpsEstado("Buscando…");
    if (!navigator.geolocation) {
      setGpsEstado("GPS no soportado en este dispositivo");
      return;
    }
    if (!window.isSecureContext) {
      setGpsEstado("GPS requiere HTTPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDraft((d) => ({ ...d, latitud: p.coords.latitude, longitud: p.coords.longitude }));
        setGpsEstado("Ubicación capturada");
      },
      (e) => {
        const msg =
          e.code === 1
            ? "permiso denegado"
            : e.code === 2
              ? "posición no disponible"
              : e.code === 3
                ? "tiempo agotado"
                : e.message;
        setGpsEstado(`GPS: ${msg}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // ---------------- Validación visible ----------------
  const pendientes = useMemo(() => {
    const p: string[] = [];
    if (!draft.siteConducted?.trim()) p.push("Site conducted");
    if (!draft.conductedOn) p.push("Conducted on (fecha y hora)");
    if (!draft.preparedBy?.trim()) p.push("Prepared by");
    if (!draft.location?.trim()) p.push("Location");

    if (conteo.sinResponder > 0) p.push(`Responder ${conteo.sinResponder} ítem(s) del check list`);
    if (conteo.sinEvidencia.length > 0) {
      const nombres = conteo.sinEvidencia
        .slice(0, 3)
        .map((id) => ITEM_INDEX[id]?.texto ?? id)
        .join(", ");
      const resto = conteo.sinEvidencia.length - 3;
      p.push(
        `Adjuntar evidencia en ${conteo.sinEvidencia.length} ítem(s) en MAL: ${nombres}${
          resto > 0 ? ` y ${resto} más` : ""
        }`,
      );
    }

    for (const o of draft.observaciones) {
      if (!o.detalle.trim()) {
        p.push("Completar el detalle de todas las observaciones (o eliminarlas)");
        break;
      }
    }

    for (const f of FIRMAS) {
      const b = draft[f.key];
      if (!b.nombre?.trim()) p.push(`Nombre — ${f.rol}`);
      if (!b.firmaDataUrl) p.push(`Firma — ${f.rol}`);
      if (!b.fecha) p.push(`Fecha — ${f.rol}`);
    }

    if (!draft.declaracionAceptada) p.push("Aceptar la declaración final");
    return p;
  }, [draft, conteo]);

  const puedeEnviar = pendientes.length === 0 && !enviando;

  // ---------------- Envío ----------------
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!puedeEnviar) return;
    if (enVueloRef.current) return;
    enVueloRef.current = true;
    setEnviando(true);

    try {
      const folio = draft.folio ?? generarFolio();
      let payload: InspeccionPayload;
      try {
        payload = await buildPayload(draft, folio);
      } catch (err) {
        setError(
          `No se pudo preparar el envío (PDF/adjuntos): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return;
      }

      const peso = pesoPayload(payload);
      if (peso > MAX_PAYLOAD_BYTES) {
        setError(
          `El envío pesa ${(peso / 1024 / 1024).toFixed(1)} MB y supera el límite de ${(
            MAX_PAYLOAD_BYTES /
            1024 /
            1024
          ).toFixed(0)} MB. Reducí la cantidad o el tamaño de las fotos.`,
        );
        return;
      }

      const res = await uploadInspeccion(payload);
      if (!res.ok) {
        // El draft NO se borra: el usuario puede reintentar con el mismo folio.
        setError(res.error ?? "El envío falló. Reintentá en unos segundos.");
        return;
      }

      saveInspectorProfile({
        preparedBy: draft.preparedBy,
        siteConducted: draft.siteConducted,
        location: draft.location,
        jefeEquipoNombre: draft.firmaJefeEquipo.nombre,
        tecnicoHSENombre: draft.firmaTecnicoHSE.nombre,
        clienteNombre: draft.firmaCliente.nombre,
      });
      clearDraft();
      setExito(res);
    } finally {
      enVueloRef.current = false;
      setEnviando(false);
    }
  }

  async function descargarPdf() {
    setGenerandoPdf(true);
    try {
      const folio = draft.folio ?? generarFolio();
      const blob = await buildChecklistPdfAsync({ draft, folio });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setError(`No se pudo generar el PDF: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerandoPdf(false);
    }
  }

  function nuevaInspeccion() {
    const perfil = loadInspectorProfile();
    setExito(null);
    setError(null);
    setAbiertas({});
    setDraft({
      ...draftVacio(),
      folio: generarFolio(),
      preparedBy: perfil?.preparedBy ?? "",
      siteConducted: perfil?.siteConducted ?? "",
      location: perfil?.location ?? "",
      firmaJefeEquipo: { nombre: perfil?.jefeEquipoNombre ?? "", fecha: hoyISOFecha() },
      firmaTecnicoHSE: { nombre: perfil?.tecnicoHSENombre ?? "", fecha: hoyISOFecha() },
      firmaCliente: { nombre: perfil?.clienteNombre ?? "", fecha: hoyISOFecha() },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function descartarBorrador() {
    if (!window.confirm("¿Descartar el borrador guardado y empezar de cero?")) return;
    clearDraft();
    setRestaurado(null);
    nuevaInspeccion();
  }

  // ---------------- Pantalla de éxito ----------------
  if (exito) {
    return (
      <div className="success-screen">
        <div className="success-card">
          <div className="success-check">✓</div>
          <h2>Check list enviado</h2>
          <p className="success-folio">
            Folio: <strong>{exito.folio}</strong>
          </p>
          <ul className="success-detalle">
            <li>{exito.items} registros de check list</li>
            <li>{exito.adjuntos} archivo(s) adjunto(s), incluido el PDF</li>
            <li>Estado general: {estadoGeneral}</li>
          </ul>
          {exito.demo ? (
            <p className="aviso-demo">
              Modo demo: la app no está conectada al flujo. <strong>No se guardó nada.</strong>
            </p>
          ) : (
            <p className="success-nota">
              Se notificó al sector correspondiente y el check list quedó cargado en SharePoint.
            </p>
          )}
          <button type="button" className="btn-primario" onClick={nuevaInspeccion}>
            Cargar otro check list
          </button>
        </div>
      </div>
    );
  }

  // ---------------- Formulario ----------------
  return (
    <form className="form" onSubmit={enviar} noValidate>
      {isDemoMode && (
        <div className="banner banner-demo">
          <strong>Modo demo.</strong> No hay endpoint configurado: podés completar y previsualizar
          el PDF, pero <strong>el envío no se guarda</strong>.
        </div>
      )}

      {restaurado && (
        <div className="banner banner-info">
          <span>
            Se restauró un borrador guardado el{" "}
            {new Date(restaurado).toLocaleString("es-AR", {
              timeZone: "America/Argentina/Buenos_Aires",
            })}
            .
          </span>
          <button type="button" className="btn-link" onClick={descartarBorrador}>
            Descartar
          </button>
        </div>
      )}

      {/* -------- Progreso -------- */}
      <div className="progreso">
        <div className="progreso-barra">
          <div
            className="progreso-relleno"
            style={{ width: `${Math.round((respondidos / TOTAL_ITEMS) * 100)}%` }}
          />
        </div>
        <div className="progreso-chips">
          <span className="chip">
            {respondidos}/{TOTAL_ITEMS} respondidos
          </span>
          <span className="chip chip-ok">BIEN {conteo.bien}</span>
          <span className="chip chip-no">MAL {conteo.mal}</span>
          <span className="chip chip-na">N/A {conteo.na}</span>
          <span className={estadoGeneral === "OK" ? "chip chip-ok" : "chip chip-no"}>
            {estadoGeneral}
          </span>
        </div>
      </div>

      {/* -------- 1 · Datos generales -------- */}
      <section className="bloque">
        <h2 className="bloque-titulo">1 · Datos generales</h2>
        <div className="grid-2">
          <label>
            Site conducted *
            <select
              value={draft.siteConducted ?? ""}
              onChange={(e) => setCampo("siteConducted", e.target.value)}
            >
              <option value="">Seleccionar equipo…</option>
              {EQUIPOS.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </label>
          <label>
            Conducted on *
            <input
              type="datetime-local"
              value={isoALocalInput(draft.conductedOn)}
              onChange={(e) => setCampo("conductedOn", localInputAIso(e.target.value))}
            />
          </label>
          <label>
            Confeccionado por *
            <input
              type="text"
              value={draft.preparedBy ?? ""}
              onChange={(e) => setCampo("preparedBy", e.target.value)}
              placeholder="Nombre y apellido"
              autoComplete="off"
            />
          </label>
          <label>
            Location *
            <input
              type="text"
              value={draft.location ?? ""}
              onChange={(e) => setCampo("location", e.target.value)}
              placeholder="Yacimiento / base"
              autoComplete="off"
            />
          </label>
          <div className="full gps-row">
            <button type="button" className="btn-secundario" onClick={capturarGps}>
              Capturar coordenadas GPS (opcional)
            </button>
            <span className="gps-estado">
              {typeof draft.latitud === "number" && typeof draft.longitud === "number"
                ? `${draft.latitud.toFixed(5)}, ${draft.longitud.toFixed(5)}`
                : (gpsEstado ?? "Sin coordenadas")}
            </span>
          </div>
        </div>
      </section>

      {/* -------- Secciones del check list -------- */}
      {SECCIONES.map((sec, i) => {
        const total = sec.items.length;
        const hechos = sec.items.filter((it) => draft.respuestas[it.id]?.estado).length;
        const malos = sec.items.filter((it) => draft.respuestas[it.id]?.estado === "MAL").length;
        const abierta = abiertas[sec.id] ?? false;
        return (
          <section className="bloque" key={sec.id}>
            <button
              type="button"
              className="bloque-header"
              onClick={() => setAbiertas((a) => ({ ...a, [sec.id]: !abierta }))}
              aria-expanded={abierta}
            >
              <span className="bloque-titulo">
                {i + 2} · {sec.titulo}
              </span>
              <span className="bloque-meta">
                <span className={hechos === total ? "chip chip-ok" : "chip"}>
                  {hechos}/{total}
                </span>
                {malos > 0 && <span className="chip chip-no">{malos} MAL</span>}
                <span className="bloque-caret">{abierta ? "▾" : "▸"}</span>
              </span>
            </button>

            {abierta && (
              <div className="bloque-body">
                {sec.campoTexto && (
                  <label className="campo-seccion">
                    {sec.campoTexto.label}
                    <input
                      type="text"
                      value={draft.secciones[sec.campoTexto.key] ?? ""}
                      onChange={(e) =>
                        setSeccionTexto(sec.campoTexto!.key, e.target.value)
                      }
                      placeholder="Identificación / detalle"
                      autoComplete="off"
                    />
                  </label>
                )}

                <div className="bloque-acciones">
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => marcarSeccion(sec, "BIEN")}
                  >
                    Completar restantes con “BIEN”
                  </button>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => marcarSeccion(sec, "N/A")}
                  >
                    Completar restantes con “N/A”
                  </button>
                </div>

                <ul className="items">
                  {sec.items.map((it) => {
                    const r = draft.respuestas[it.id];
                    const esMal = r?.estado === "MAL";
                    const faltaEvidencia = esMal && !r?.evidenciaDataUrl;
                    return (
                      <li className={faltaEvidencia ? "item item-alerta" : "item"} key={it.id}>
                        <div className="item-texto">{it.texto}</div>
                        <div className="item-estados" role="group" aria-label={it.texto}>
                          {ESTADOS_ITEM.map((op) => (
                            <label
                              key={op}
                              className={
                                r?.estado === op
                                  ? `opt opt-${
                                      op === "N/A" ? "na" : op === "BIEN" ? "bien" : "mal"
                                    } opt-sel`
                                  : "opt"
                              }
                            >
                              <input
                                type="radio"
                                name={`estado-${it.id}`}
                                checked={r?.estado === op}
                                onChange={() => setEstado(it.id, op)}
                              />
                              <span>{op}</span>
                            </label>
                          ))}
                        </div>

                        {esMal && (
                          <div className="item-detalle">
                            <textarea
                              className="item-comentario"
                              value={r?.comentarios ?? ""}
                              onChange={(e) => setComentario(it.id, e.target.value)}
                              placeholder="Comentario (opcional)"
                              rows={2}
                            />
                            <div className="item-evidencia">
                              {r?.evidenciaDataUrl ? (
                                <div className="evidencia-preview">
                                  <img src={r.evidenciaDataUrl} alt={`Evidencia ${it.texto}`} />
                                  <button
                                    type="button"
                                    className="btn-link"
                                    onClick={() => void setEvidencia(it.id, null)}
                                  >
                                    Quitar foto
                                  </button>
                                </div>
                              ) : (
                                <label className="evidencia-slot">
                                  <span>📷 Adjuntar evidencia *</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) =>
                                      void setEvidencia(it.id, e.target.files?.[0] ?? null)
                                    }
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      {/* -------- Observaciones relevantes -------- */}
      <section className="bloque">
        <h2 className="bloque-titulo">{SECCIONES.length + 2} · Observaciones relevantes</h2>
        <div className="bloque-body">
          {draft.observaciones.length === 0 && (
            <p className="texto-suave">Sin observaciones cargadas.</p>
          )}
          {draft.observaciones.map((o, i) => (
            <div className="observacion" key={o.id}>
              <div className="observacion-head">
                <strong>Observación {i + 1}</strong>
                <button
                  type="button"
                  className="btn-link btn-peligro"
                  onClick={() => eliminarObservacion(o.id)}
                >
                  Eliminar
                </button>
              </div>
              <textarea
                value={o.detalle}
                onChange={(e) => actualizarObservacion(o.id, { detalle: e.target.value })}
                placeholder="Detalle de la observación"
                rows={2}
              />
              <div className="grid-2">
                <label>
                  Estado
                  <select
                    value={o.estado}
                    onChange={(e) =>
                      actualizarObservacion(o.id, {
                        estado: e.target.value as EstadoObservacion,
                      })
                    }
                  >
                    {ESTADOS_OBSERVACION.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fecha de cumplimiento
                  <input
                    type="date"
                    value={o.fechaCumplimiento ?? ""}
                    onChange={(e) =>
                      actualizarObservacion(o.id, { fechaCumplimiento: e.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          ))}
          <button type="button" className="btn-secundario" onClick={agregarObservacion}>
            + Agregar observación
          </button>
        </div>
      </section>

      {/* -------- Firmas -------- */}
      <section className="bloque">
        <h2 className="bloque-titulo">{SECCIONES.length + 3} · Firmas</h2>
        <div className="bloque-body firmas">
          {FIRMAS.map(({ key, rol }) => {
            const b = draft[key];
            return (
              <div className="firma-bloque" key={key}>
                <div className="firma-title">{rol} *</div>
                <div className="grid-2">
                  <label>
                    Nombre
                    <input
                      type="text"
                      value={b.nombre ?? ""}
                      onChange={(e) => setFirma(key, { nombre: e.target.value })}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Fecha
                    <input
                      type="date"
                      value={b.fecha ?? ""}
                      onChange={(e) => setFirma(key, { fecha: e.target.value })}
                    />
                  </label>
                </div>
                {/* El canvas NUNCA va dentro de un <label>: rompe el trazo en touch. */}
                <SignaturePad
                  value={b.firmaDataUrl}
                  onChange={(dataUrl) => setFirma(key, { firmaDataUrl: dataUrl })}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* -------- Declaración final -------- */}
      <section className="bloque">
        <h2 className="bloque-titulo">{SECCIONES.length + 4} · Declaración final</h2>
        <div className="bloque-body">
          <label className="declaracion">
            <input
              type="checkbox"
              checked={draft.declaracionAceptada === true}
              onChange={(e) => setCampo("declaracionAceptada", e.target.checked)}
            />
            <span>{TEXTO_DECLARACION}</span>
          </label>
        </div>
      </section>

      {/* -------- Pendientes + envío -------- */}
      {pendientes.length > 0 && (
        <div className="pendientes">
          <div className="pendientes-titulo">Falta completar antes de enviar:</div>
          <ul>
            {pendientes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="banner banner-error">
          <strong>No se pudo enviar.</strong> {error}
          <div className="banner-nota">
            Tu carga sigue guardada en este dispositivo: podés reintentar sin perder nada.
          </div>
        </div>
      )}

      <div className="acciones-final">
        <button
          type="button"
          className="btn-secundario"
          onClick={descargarPdf}
          disabled={generandoPdf}
        >
          {generandoPdf ? "Generando PDF…" : "Descargar PDF de previsualización"}
        </button>
        <button type="submit" className="btn-primario" disabled={!puedeEnviar}>
          {enviando ? "Enviando…" : error ? "Reintentar envío" : "Enviar check list"}
        </button>
      </div>

      <p className="folio-pie">
        Folio asignado: <strong>{draft.folio ?? "—"}</strong>
      </p>
    </form>
  );
}

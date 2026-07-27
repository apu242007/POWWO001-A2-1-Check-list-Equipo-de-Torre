import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  height?: number;
  disabled?: boolean;
}

/**
 * Pad de firma basado en Pointer Events (unifica mouse/touch/pen).
 * NUNCA envolver este componente en un <label>: en touch el label absorbe el
 * primer evento y el trazo no arranca.
 */
export default function SignaturePad({ value, onChange, height = 150, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const initRef = useRef(false);
  const dirtyRef = useRef(false);
  const [vacio, setVacio] = useState(!value);

  const getCtx = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "#111827";
    return ctx;
  }, []);

  /** Ajusta el bitmap al tamaño CSS × dpr preservando lo dibujado. */
  const resyncCanvas = useCallback((): boolean => {
    const c = canvasRef.current;
    if (!c) return false;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (c.width === targetW && c.height === targetH) return true;

    const tieneContenido = c.width > 0 && c.height > 0 && dirtyRef.current;
    const snapshot = tieneContenido ? c.toDataURL("image/png") : null;

    c.width = targetW;
    c.height = targetH;
    const ctx = getCtx();
    if (!ctx) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (snapshot) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = snapshot;
    }
    return true;
  }, [getCtx]);

  const dibujarDataUrl = useCallback(
    (dataUrl: string) => {
      const c = canvasRef.current;
      const ctx = getCtx();
      if (!c || !ctx) return;
      const rect = c.getBoundingClientRect();
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        dirtyRef.current = true;
        setVacio(false);
      };
      img.src = dataUrl;
    },
    [getCtx],
  );

  // Init una sola vez (StrictMode monta dos veces en dev).
  useEffect(() => {
    if (initRef.current) return;
    if (!resyncCanvas()) return;
    initRef.current = true;
    if (value && value.length > 200) dibujarDataUrl(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => {
      if (drawingRef.current) return;
      resyncCanvas();
    });
    ro.observe(c);
    return () => ro.disconnect();
  }, [resyncCanvas]);

  function getXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    try {
      c.setPointerCapture(e.pointerId);
    } catch {
      /* algunos navegadores lo rechazan; el dibujo sigue funcionando */
    }
    drawingRef.current = true;
    dirtyRef.current = true;
    const { x, y } = getXY(e);
    // Punto inicial visible: confirma que pointerdown disparó aunque no haya movimiento.
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    setVacio(false);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getXY(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function finalizar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const c = canvasRef.current;
    if (!c) return;
    try {
      c.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    const dataUrl = c.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 200 || dataUrl === "data:,") return;
    onChange(dataUrl);
  }

  function limpiar() {
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    dirtyRef.current = false;
    setVacio(true);
    onChange(undefined);
  }

  return (
    <div className="firma-pad">
      <canvas
        ref={canvasRef}
        className="firma-canvas"
        style={{ touchAction: "none", height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
      />
      <div className="firma-pad-footer">
        <span className={vacio ? "firma-hint" : "firma-hint firma-hint-ok"}>
          {vacio ? "Firmá con el dedo o el mouse" : "✓ Firma capturada"}
        </span>
        <button type="button" className="btn-link" onClick={limpiar} disabled={disabled}>
          Borrar
        </button>
      </div>
    </div>
  );
}

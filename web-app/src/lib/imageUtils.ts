/**
 * Compresión de imágenes — defensa en profundidad (capa 1: file picker, capa 2: upload).
 * `compressImage` es idempotente: reprocesar un JPEG ya comprimido devuelve algo equivalente.
 */
export async function compressImage(
  file: Blob,
  maxSide = 1280,
  quality = 0.72,
): Promise<Blob> {
  const type = file.type ?? "";
  if (!type.startsWith("image/") || type === "image/svg+xml") return file;

  try {
    const bmp = await createImageBitmap(file);
    const ratio = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * ratio));
    const h = Math.max(1, Math.round(bmp.height * ratio));

    let blob: Blob;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0, w, h);
      blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bmp, 0, 0, w, h);
      blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality);
      });
    }
    bmp.close?.();
    return blob;
  } catch {
    return file;
  }
}

/** Comprime y devuelve un File con nombre estable (mantiene el flujo tipado). */
export async function compressToFile(file: File, baseName?: string): Promise<File> {
  const blob = await compressImage(file);
  const name = baseName ? `${baseName}.jpg` : file.name.replace(/\.[^.]+$/, "") + ".jpg";
  if (blob === (file as Blob)) return file;
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

/** Blob → base64 SIN el prefijo `data:...;base64,` (lo que espera base64ToBinary en el flow). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const res = String(fr.result ?? "");
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    fr.readAsDataURL(blob);
  });
}

/** Blob → dataURL completa (para previews y para embeber en el PDF). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.readAsDataURL(blob);
  });
}

/** dataURL → base64 puro. */
export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/** dataURL → Blob (para reconstruir evidencias restauradas desde un draft). */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [head, data] = dataUrl.split(",");
    if (!data) return null;
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/** Tamaño aproximado en bytes de una cadena base64. */
export function base64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

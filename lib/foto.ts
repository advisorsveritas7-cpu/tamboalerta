/**
 * Comprime una foto en el navegador antes de subirla: redimensiona a 1024 px de lado mayor
 * y la recodifica a JPEG. Una foto de celular de 3–5 MB queda en ~80–200 KB.
 */
export async function comprimirFoto(archivo: File, ladoMax = 1024, calidad = 0.6): Promise<Blob> {
  const bitmap = await cargarImagen(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap) (bitmap as ImageBitmap).close();
  let blob = await aBlob(canvas, calidad);
  // Si aún pesa más de 250 KB, un segundo intento más agresivo.
  if (blob.size > 250_000) blob = await aBlob(canvas, 0.45);
  return blob;
}

function aBlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob> {
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo comprimir la foto'))), 'image/jpeg', calidad));
}

async function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // respeta la orientación EXIF de las fotos de celular
      return await createImageBitmap(archivo, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {}
  }
  const url = URL.createObjectURL(archivo);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

export function blobADataUrl(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as string);
    r.onerror = mal;
    r.readAsDataURL(b);
  });
}

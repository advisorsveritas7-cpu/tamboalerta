// Prepara un video corto para subirlo con poca señal: máximo 15 s, ~480 px y sin audio.
// Si el teléfono ya lo grabó liviano (≤ 6 MB y ≤ 16 s) se usa tal cual.

export const MAX_SEG = 15;

function metadatos(url: string): Promise<HTMLVideoElement> {
  return new Promise((ok, mal) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => ok(v);
    v.onerror = () => mal(new Error('No se pudo leer el video.'));
    v.src = url;
  });
}

function tipoGrabacion(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export async function prepararVideo(f: File, alAvanzar?: (p: number) => void): Promise<{ blob: Blob; tipo: string; segundos: number }> {
  const url = URL.createObjectURL(f);
  try {
    const v = await metadatos(url);
    const dur = Number.isFinite(v.duration) ? v.duration : MAX_SEG;
    if (f.size <= 6 * 1024 * 1024 && dur <= MAX_SEG + 1) return { blob: f, tipo: f.type || 'video/mp4', segundos: Math.round(dur) };

    const tipo = tipoGrabacion();
    const capturar = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (!tipo) throw new Error('Este teléfono no puede achicar el video. Graba uno de menos de 15 segundos.');

    // Se reproduce el video en un lienzo pequeño y se graba de nuevo con baja calidad.
    const escala = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round((v.videoWidth * escala) / 2) * 2;
    lienzo.height = Math.round((v.videoHeight * escala) / 2) * 2;
    const ctx = lienzo.getContext('2d')!;
    const flujo = lienzo.captureStream(24);
    const rec = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 650_000 });
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    const fin = new Promise<void>((ok) => (rec.onstop = () => ok()));
    const limite = Math.min(dur, MAX_SEG);
    v.currentTime = 0;
    await v.play();
    rec.start(500);
    await new Promise<void>((ok) => {
      const cuadro = () => {
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
        alAvanzar?.(Math.min(1, v.currentTime / limite));
        if (v.currentTime >= limite || v.ended) return ok();
        requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);
    });
    v.pause();
    rec.stop();
    await fin;
    void capturar;
    const blob = new Blob(partes, { type: tipo.split(';')[0] });
    if (blob.size > 10 * 1024 * 1024) throw new Error('El video sigue muy pesado. Graba uno más corto.');
    return { blob, tipo: tipo.split(';')[0], segundos: Math.round(limite) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

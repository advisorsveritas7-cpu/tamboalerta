import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App de TamboAlerta para Play Store (Android) y App Store (iPhone).
 * La app abre el sitio publicado, así que cada cambio que se publica en la web
 * llega a los teléfonos al instante, sin volver a subir la app a las tiendas.
 */
const config: CapacitorConfig = {
  appId: 'pe.tamboalerta.app',
  appName: 'TamboAlerta',
  webDir: 'out',
  backgroundColor: '#0A192F',
  server: {
    url: process.env.TAMBOALERTA_URL || 'https://advisorsveritas7-cpu.github.io/tamboalerta/',
    cleartext: false,
    errorPath: 'sin-conexion.html',
  },
  android: { backgroundColor: '#0A192F' },
  ios: { backgroundColor: '#0A192F', contentInset: 'never' },
};

export default config;

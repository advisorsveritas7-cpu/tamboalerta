// Empaqueta la app en archivos estáticos simples (sin Next.js) para la vista previa publicada.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const out = 'vista-previa/dist';
mkdirSync(`${out}/data`, { recursive: true });
await build({
  entryPoints: ['vista-previa/main.tsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  jsx: 'automatic',
  outfile: `${out}/app.js`,
  alias: { 'next/dynamic': './vista-previa/dynamic-shim.tsx', '@': '.' },
  loader: { '.css': 'empty' },
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '""',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '""',
    'process.env.NODE_ENV': '"production"',
  },
  external: ['@supabase/supabase-js'],
});
execSync(`npx tailwindcss -i app/globals.css -o ${out}/tw.css --minify`, { stdio: 'inherit' });
writeFileSync(`${out}/app.css`, readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8') + readFileSync(`${out}/tw.css`, 'utf8'));
unlinkSync(`${out}/tw.css`);
copyFileSync('public/data/tambogrande.json', `${out}/data/tambogrande.json`);
console.log('vista previa lista en', out);

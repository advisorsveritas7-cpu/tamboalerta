import type { SupabaseClient } from '@supabase/supabase-js';
import { MODO_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

let cliente: Promise<SupabaseClient> | null = null;

/** Cliente de Supabase cargado bajo demanda (no pesa nada en modo local). */
export function supabase(): Promise<SupabaseClient> | null {
  if (!MODO_SUPABASE) return null;
  if (!cliente) {
    cliente = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 5 } } }),
    );
  }
  return cliente;
}

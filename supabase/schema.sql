-- TamboAlerta · esquema de Supabase
-- Ejecutar en Supabase > SQL Editor. Crea tablas, permisos (RLS), bucket de fotos y tiempo real.

-- 1. Reportes ciudadanos: SOLO estado de calles y transitabilidad.
create table if not exists public.reportes (
  id          uuid primary key default gen_random_uuid(),
  creado      timestamptz not null default now(),
  lat         double precision not null check (lat between -5.20 and -4.70),
  lon         double precision not null check (lon between -80.60 and -80.00),
  lugar       text not null check (char_length(lugar) between 2 and 120),
  nivel       text not null check (nivel in ('tobillos', 'rodillas', 'cintura')),
  descripcion text check (char_length(descripcion) <= 140),
  foto_url    text
);
create index if not exists reportes_creado_idx on public.reportes (creado desc);

alter table public.reportes enable row level security;
-- Cualquiera puede ver y crear reportes (sin cuenta, para que sea rápido en emergencia).
drop policy if exists "ver reportes" on public.reportes;
create policy "ver reportes" on public.reportes for select using (true);
drop policy if exists "crear reportes" on public.reportes;
create policy "crear reportes" on public.reportes for insert to anon, authenticated with check (true);
-- Solo coordinadores pueden borrar (p. ej. reportes falsos).
drop policy if exists "borrar reportes" on public.reportes;
create policy "borrar reportes" on public.reportes for delete to authenticated using (true);

-- 2. Avisos meteorológicos SENAMHI publicados por coordinadores.
create table if not exists public.avisos (
  id         uuid primary key default gen_random_uuid(),
  creado     timestamptz not null default now(),
  nivel      text not null check (nivel in ('amarillo', 'naranja', 'rojo')),
  titulo     text not null,
  numero     text,
  inicio     timestamptz not null,
  fin        timestamptz not null,
  lluvia_mm  integer not null check (lluvia_mm between 0 and 300),
  detalle    text,
  ejemplo    boolean not null default false
);
alter table public.avisos enable row level security;
drop policy if exists "ver avisos" on public.avisos;
create policy "ver avisos" on public.avisos for select using (true);
drop policy if exists "coordinadores publican" on public.avisos;
create policy "coordinadores publican" on public.avisos for insert to authenticated with check (true);
drop policy if exists "coordinadores retiran" on public.avisos;
create policy "coordinadores retiran" on public.avisos for delete to authenticated using (true);

-- 3. Tiempo real
alter publication supabase_realtime add table public.reportes;
alter publication supabase_realtime add table public.avisos;

-- 4. Fotos (bucket público, solo JPEG de hasta 1 MB; la app las comprime a ~150 KB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "subir fotos" on storage.objects;
create policy "subir fotos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos');
drop policy if exists "ver fotos" on storage.objects;
create policy "ver fotos" on storage.objects for select using (bucket_id = 'fotos');

-- Coordinadores: créalos en Authentication > Users > "Add user" (correo).
-- Deja desactivado "Allow new users to sign up" para que nadie más pueda publicar avisos.

-- TamboAlerta · esquema de Supabase
-- Ejecutar en Supabase > SQL Editor. Crea tablas, permisos (RLS), bucket de fotos/videos y tiempo real.
-- Se puede ejecutar varias veces sin error.

-- 1. Reportes ciudadanos: SOLO estado de calles y transitabilidad.
create table if not exists public.reportes (
  id          uuid primary key default gen_random_uuid(),
  creado      timestamptz not null default now(),
  lat         double precision not null,
  lon         double precision not null,
  lugar       text not null check (char_length(lugar) between 2 and 120),
  nivel       text not null check (nivel in ('tobillos', 'rodillas', 'cintura')),
  descripcion text check (char_length(descripcion) <= 140),
  foto_url    text,
  video_url   text
);
-- Toda la región Piura (aprox.). Se reescriben por si la tabla ya existía con el límite antiguo de Tambogrande.
alter table public.reportes add column if not exists video_url text;
alter table public.reportes drop constraint if exists reportes_lat_check;
alter table public.reportes drop constraint if exists reportes_lon_check;
alter table public.reportes add constraint reportes_lat_check check (lat between -6.6 and -3.9);
alter table public.reportes add constraint reportes_lon_check check (lon between -81.5 and -79.0);
create index if not exists reportes_creado_idx on public.reportes (creado desc);

-- Revisión: ningún reporte se ve hasta que un coordinador lo aprueba (evita fotos o videos inadecuados).
alter table public.reportes add column if not exists aprobado boolean not null default false;
alter table public.reportes add column if not exists denuncias integer not null default 0;

-- Coordinadores: correos autorizados para revisar reportes y publicar avisos.
-- Para agregar uno:  insert into public.coordinadores (email) values ('correo@ejemplo.com');
create table if not exists public.coordinadores (email text primary key, creado timestamptz not null default now());
alter table public.coordinadores enable row level security;
create or replace function public.es_coordinador() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coordinadores where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.es_coordinador() to anon, authenticated;

alter table public.reportes enable row level security;
-- Los vecinos ven solo lo aprobado; los coordinadores ven todo para revisarlo.
drop policy if exists "ver reportes" on public.reportes;
create policy "ver reportes" on public.reportes for select using (aprobado or public.es_coordinador());
-- Cualquiera puede enviar (sin cuenta, para que sea rápido en emergencia), pero entra sin aprobar.
drop policy if exists "crear reportes" on public.reportes;
create policy "crear reportes" on public.reportes for insert to anon, authenticated with check (aprobado = false and denuncias = 0);
drop policy if exists "revisar reportes" on public.reportes;
create policy "revisar reportes" on public.reportes for update to authenticated using (public.es_coordinador()) with check (public.es_coordinador());
drop policy if exists "borrar reportes" on public.reportes;
create policy "borrar reportes" on public.reportes for delete to authenticated using (public.es_coordinador());

-- Denunciar contenido inadecuado: con 2 denuncias el reporte vuelve a revisión y deja de verse.
create or replace function public.denunciar(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.reportes
     set denuncias = denuncias + 1,
         aprobado = case when denuncias + 1 >= 2 then false else aprobado end
   where id = p_id and aprobado;
$$;
grant execute on function public.denunciar(uuid) to anon, authenticated;

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
create policy "coordinadores publican" on public.avisos for insert to authenticated with check (public.es_coordinador());
drop policy if exists "coordinadores retiran" on public.avisos;
create policy "coordinadores retiran" on public.avisos for delete to authenticated using (public.es_coordinador());

-- 3. Tiempo real
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reportes') then
    alter publication supabase_realtime add table public.reportes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'avisos') then
    alter publication supabase_realtime add table public.avisos;
  end if;
end $$;

-- 4. Fotos y videos cortos (bucket público; fotos JPEG comprimidas, videos de hasta 15 s y 10 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 10485760, array['image/jpeg', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "subir fotos" on storage.objects;
create policy "subir fotos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos');
drop policy if exists "ver fotos" on storage.objects;
create policy "ver fotos" on storage.objects for select using (bucket_id = 'fotos');

-- Coordinadores: créalos en Authentication > Users > "Add user" > "Create new user" (correo y contraseña,
-- marcando "Auto Confirm User") y agrega su correo a public.coordinadores (ver arriba).

-- Permisos de la API (necesarios si el proyecto no expone tablas nuevas automáticamente)
grant usage on schema public to anon, authenticated;
grant select, insert on public.reportes to anon, authenticated;
grant update, delete on public.reportes to authenticated;
grant select on public.avisos to anon, authenticated;
grant insert, delete on public.avisos to authenticated;

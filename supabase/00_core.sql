create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('jefe', 'tecnico', 'usuario');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.maintenance_type as enum ('preventivo', 'inspeccion', 'correctivo');
exception
  when duplicate_object then null;
end $$;

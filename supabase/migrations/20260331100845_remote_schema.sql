


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."platform_role" AS ENUM (
    'platform_admin',
    'platform_support',
    'platform_operations',
    'platform_readonly'
);


ALTER TYPE "public"."platform_role" OWNER TO "postgres";


CREATE TYPE "public"."tenant_role" AS ENUM (
    'tenant_admin',
    'tenant_viewer',
    'tenant_marketing'
);


ALTER TYPE "public"."tenant_role" OWNER TO "postgres";


CREATE TYPE "public"."user_scope" AS ENUM (
    'global',
    'tenant',
    'hybrid'
);


ALTER TYPE "public"."user_scope" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'active',
    'pending',
    'blocked',
    'disabled'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_marketing"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.tenant_members tm
     where tm.tenant_id = p_tenant_id
       and tm.user_id   = auth.uid()
       and tm.is_active = true
       and tm.role in ('tenant_admin','tenant_marketing')
  );
$$;


ALTER FUNCTION "public"."can_marketing"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (
    user_id,
    full_name,
    email,
    status,
    scope,
    is_platform_user
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'pending',
    'tenant',
    false
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_tenant_role"("p_tenant_id" "uuid", "p_roles" "public"."tenant_role"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select
    public.is_super()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
        and tm.role = any(p_roles)
    );
$$;


ALTER FUNCTION "public"."has_tenant_role"("p_tenant_id" "uuid", "p_roles" "public"."tenant_role"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'global_role') = 'super', false);
$$;


ALTER FUNCTION "public"."is_super"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tenant_admin"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.tenant_members tm
     where tm.tenant_id = p_tenant_id
       and tm.user_id   = auth.uid()
       and tm.is_active = true
       and tm.role      = 'tenant_admin'
  );
$$;


ALTER FUNCTION "public"."is_tenant_admin"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.tenant_members tm
     where tm.tenant_id = p_tenant_id
       and tm.user_id   = auth.uid()
       and tm.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_settings_seed_for_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.portal_settings (tenant_id, brand_name)
  values (new.id, new.name)
  on conflict (tenant_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."portal_settings_seed_for_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."portal_settings_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."portal_settings_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_created_day"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- Usa UTC para não depender do timezone do cliente
  new.created_day := ((new.created_at at time zone 'UTC')::date);
  return new;
end;
$$;


ALTER FUNCTION "public"."set_created_day"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_wifi_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text" DEFAULT NULL::"text", "p_hotspot_user" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_id uuid;
begin
  insert into public.wifi_devices
    (id, tenant_id, mac_address, device_type, first_seen, last_seen, device_name, hotspot_user, created_at, updated_at)
  values
    (gen_random_uuid(), p_tenant_id, upper(p_mac_address), p_device_type, now(), now(), p_device_name, p_hotspot_user, now(), now())
  on conflict (tenant_id, mac_address)
  do update set
    last_seen   = now(),
    device_type = excluded.device_type,
    device_name = coalesce(excluded.device_name, public.wifi_devices.device_name),
    hotspot_user= coalesce(excluded.hotspot_user, public.wifi_devices.hotspot_user),
    updated_at  = now()
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."upsert_wifi_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_wifi_lead"("p_tenant_id" "uuid", "p_device_id" "uuid", "p_phone" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_full_name" "text", "p_city" "text", "p_tenant_slug" "text") RETURNS TABLE("lead_id" "uuid", "inserted" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
  insert into public.wifi_leads
  (
    tenant_id,
    device_id,
    phone,
    marketing_optin,
    source,
    campaign_id,
    full_name,
    city,
    tenant_slug
  )
  values
  (
    p_tenant_id,
    p_device_id,
    p_phone,
    p_marketing_optin,
    p_source,
    p_campaign_id,
    p_full_name,
    p_city,
    p_tenant_slug
  )
  on conflict (tenant_id, phone, created_day)
  where phone is not null and phone <> ''
  do update set
    device_id        = excluded.device_id,
    full_name        = excluded.full_name,
    city             = excluded.city,
    marketing_optin  = excluded.marketing_optin,
    updated_at       = now()
  returning id, (xmax = 0) as inserted;
end;
$$;


ALTER FUNCTION "public"."upsert_wifi_lead"("p_tenant_id" "uuid", "p_device_id" "uuid", "p_phone" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_full_name" "text", "p_city" "text", "p_tenant_slug" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."wifi_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "device_id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "marketing_optin" boolean DEFAULT false NOT NULL,
    "source" "text",
    "campaign_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "city" "text",
    "created_day" "date",
    "tenant_slug" "text",
    "unit_id" "uuid",
    CONSTRAINT "wifi_leads_city_chk" CHECK ((("city" IS NULL) OR ("length"(TRIM(BOTH FROM "city")) >= 2))),
    CONSTRAINT "wifi_leads_email_chk" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text"))),
    CONSTRAINT "wifi_leads_full_name_chk" CHECK ((("full_name" IS NULL) OR ("length"(TRIM(BOTH FROM "full_name")) >= 2)))
);


ALTER TABLE "public"."wifi_leads" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wifi_lead_capture"("p_tenant_id" "uuid", "p_mac_address" "text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_full_name" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_marketing_optin" boolean DEFAULT false, "p_source" "text" DEFAULT 'captive_portal'::"text", "p_campaign_id" "uuid" DEFAULT NULL::"uuid", "p_device_type" "text" DEFAULT NULL::"text", "p_device_name" "text" DEFAULT NULL::"text", "p_hotspot_user" "text" DEFAULT NULL::"text") RETURNS "public"."wifi_leads"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dev public.wifi_devices;
  v_lead public.wifi_leads;
begin
  -- upsert device (reaproveita sua função já criada)
  v_dev := public.wifi_upsert_device(
    p_tenant_id,
    p_mac_address,
    p_device_type,
    p_device_name,
    p_hotspot_user
  );

  insert into public.wifi_leads (
    tenant_id, device_id,
    email, phone, full_name, city,
    marketing_optin,
    source, campaign_id,
    created_at, updated_at
  )
  values (
    p_tenant_id, v_dev.id,
    nullif(trim(p_email),''),
    nullif(trim(p_phone),''),
    nullif(trim(p_full_name),''),
    nullif(trim(p_city),''),
    coalesce(p_marketing_optin,false),
    nullif(trim(p_source),''),
    p_campaign_id,
    now(), now()
  )
  returning * into v_lead;

  return v_lead;
end;
$$;


ALTER FUNCTION "public"."wifi_lead_capture"("p_tenant_id" "uuid", "p_mac_address" "text", "p_email" "text", "p_phone" "text", "p_full_name" "text", "p_city" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."wifi_lead_capture"("p_tenant_id" "uuid", "p_mac_address" "text", "p_email" "text", "p_phone" "text", "p_full_name" "text", "p_city" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") IS 'Captura lead (email/phone/nome/cidade/opt-in) amarrado ao device via MAC. Uso recomendado: backend/service role.';



CREATE TABLE IF NOT EXISTS "public"."wifi_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "device_id" "uuid" NOT NULL,
    "login_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "logout_time" timestamp with time zone,
    "duration_seconds" integer GENERATED ALWAYS AS (
CASE
    WHEN ("logout_time" IS NULL) THEN NULL::integer
    ELSE GREATEST(0, ("floor"(EXTRACT(epoch FROM ("logout_time" - "login_time"))))::integer)
END) STORED,
    "ip_address" "inet",
    "access_point" "text",
    "nas_identifier" "text",
    "mikrotik_session_id" "text",
    "auth_method" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unit_id" "uuid",
    CONSTRAINT "wifi_sessions_logout_after_login_chk" CHECK ((("logout_time" IS NULL) OR ("logout_time" >= "login_time")))
);


ALTER TABLE "public"."wifi_sessions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wifi_session_login"("p_tenant_id" "uuid", "p_mac_address" "text", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_access_point" "text" DEFAULT NULL::"text", "p_nas_identifier" "text" DEFAULT NULL::"text", "p_mikrotik_session_id" "text" DEFAULT NULL::"text", "p_auth_method" "text" DEFAULT NULL::"text", "p_device_type" "text" DEFAULT NULL::"text", "p_device_name" "text" DEFAULT NULL::"text", "p_hotspot_user" "text" DEFAULT NULL::"text", "p_login_time" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."wifi_sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dev public.wifi_devices;
  v_sess public.wifi_sessions;
  v_login timestamptz;
begin
  v_login := coalesce(p_login_time, now());

  -- 1) upsert device
  v_dev := public.wifi_upsert_device(
    p_tenant_id,
    p_mac_address,
    p_device_type,
    p_device_name,
    p_hotspot_user
  );

  -- 2) fecha sessões abertas anteriores (fail-safe)
  update public.wifi_sessions
     set logout_time = v_login,
         updated_at  = now()
   where tenant_id = p_tenant_id
     and device_id = v_dev.id
     and logout_time is null
     and login_time < v_login;

  -- 3) cria nova sessão
  insert into public.wifi_sessions (
    tenant_id, device_id, login_time,
    ip_address, access_point, nas_identifier,
    mikrotik_session_id, auth_method
  )
  values (
    p_tenant_id, v_dev.id, v_login,
    p_ip_address,
    nullif(trim(p_access_point),''),
    nullif(trim(p_nas_identifier),''),
    nullif(trim(p_mikrotik_session_id),''),
    nullif(trim(p_auth_method),'')
  )
  returning * into v_sess;

  return v_sess;
end;
$$;


ALTER FUNCTION "public"."wifi_session_login"("p_tenant_id" "uuid", "p_mac_address" "text", "p_ip_address" "inet", "p_access_point" "text", "p_nas_identifier" "text", "p_mikrotik_session_id" "text", "p_auth_method" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text", "p_login_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."wifi_session_login"("p_tenant_id" "uuid", "p_mac_address" "text", "p_ip_address" "inet", "p_access_point" "text", "p_nas_identifier" "text", "p_mikrotik_session_id" "text", "p_auth_method" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text", "p_login_time" timestamp with time zone) IS 'Cria sessão de WiFi (login). Fecha sessão aberta anterior do mesmo device (fail-safe). Uso recomendado: backend/service role.';



CREATE OR REPLACE FUNCTION "public"."wifi_session_logout"("p_tenant_id" "uuid", "p_mac_address" "text", "p_logout_time" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_mikrotik_session_id" "text" DEFAULT NULL::"text") RETURNS "public"."wifi_sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dev_id uuid;
  v_logout timestamptz;
  v_sess public.wifi_sessions;
begin
  v_logout := coalesce(p_logout_time, now());

  select d.id
    into v_dev_id
    from public.wifi_devices d
   where d.tenant_id = p_tenant_id
     and d.mac_address = upper(trim(p_mac_address))
   limit 1;

  if v_dev_id is null then
    raise exception 'device_not_found';
  end if;

  -- Atualiza last_seen do device
  update public.wifi_devices
     set last_seen = v_logout,
         updated_at = now()
   where id = v_dev_id;

  if nullif(trim(p_mikrotik_session_id),'') is not null then
    update public.wifi_sessions
       set logout_time = v_logout,
           updated_at  = now()
     where tenant_id = p_tenant_id
       and device_id = v_dev_id
       and mikrotik_session_id = trim(p_mikrotik_session_id)
       and logout_time is null
     returning * into v_sess;
  else
    update public.wifi_sessions
       set logout_time = v_logout,
           updated_at  = now()
     where id = (
       select s.id
         from public.wifi_sessions s
        where s.tenant_id = p_tenant_id
          and s.device_id = v_dev_id
          and s.logout_time is null
        order by s.login_time desc
        limit 1
     )
     returning * into v_sess;
  end if;

  if v_sess.id is null then
    raise exception 'open_session_not_found';
  end if;

  return v_sess;
end;
$$;


ALTER FUNCTION "public"."wifi_session_logout"("p_tenant_id" "uuid", "p_mac_address" "text", "p_logout_time" timestamp with time zone, "p_mikrotik_session_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."wifi_session_logout"("p_tenant_id" "uuid", "p_mac_address" "text", "p_logout_time" timestamp with time zone, "p_mikrotik_session_id" "text") IS 'Fecha sessão de WiFi (logout). Prioriza mikrotik_session_id; senão fecha sessão aberta mais recente. Uso recomendado: backend/service role.';



CREATE OR REPLACE FUNCTION "public"."wifi_stats"("p_tenant_id" "uuid", "p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_total_period bigint;
  v_today_total bigint;
  v_optin_period bigint;
  v_top_cities jsonb;
begin
  select count(*) into v_total_period
  from public.wifi_leads
  where tenant_id = p_tenant_id
    and created_day between p_from and p_to;

  select count(*) into v_today_total
  from public.wifi_leads
  where tenant_id = p_tenant_id
    and created_day = v_today;

  select count(*) into v_optin_period
  from public.wifi_leads
  where tenant_id = p_tenant_id
    and created_day between p_from and p_to
    and marketing_optin = true;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top_cities
  from (
    select city, count(*) as total
    from public.wifi_leads
    where tenant_id = p_tenant_id
      and created_day between p_from and p_to
      and city is not null and btrim(city) <> ''
    group by city
    order by total desc
    limit 10
  ) t;

  return jsonb_build_object(
    'today', v_today_total,
    'period_total', v_total_period,
    'period_optin', v_optin_period,
    'top_cities', v_top_cities
  );
end;
$$;


ALTER FUNCTION "public"."wifi_stats"("p_tenant_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wifi_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "mac_address" "text" NOT NULL,
    "device_type" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "first_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "device_name" "text",
    "hotspot_user" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unit_id" "uuid",
    CONSTRAINT "wifi_devices_mac_chk" CHECK (("mac_address" ~* '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'::"text"))
);


ALTER TABLE "public"."wifi_devices" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wifi_upsert_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text" DEFAULT NULL::"text", "p_device_name" "text" DEFAULT NULL::"text", "p_hotspot_user" "text" DEFAULT NULL::"text") RETURNS "public"."wifi_devices"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_dev public.wifi_devices;
  v_mac text;
begin
  v_mac := upper(trim(p_mac_address));

  insert into public.wifi_devices (
    tenant_id, mac_address, device_type, device_name, hotspot_user, first_seen, last_seen
  )
  values (
    p_tenant_id,
    v_mac,
    coalesce(nullif(trim(p_device_type),''), 'unknown'),
    nullif(trim(p_device_name),''),
    nullif(trim(p_hotspot_user),''),
    now(),
    now()
  )
  on conflict (tenant_id, mac_address)
  do update set
    last_seen    = now(),
    device_type  = coalesce(excluded.device_type, public.wifi_devices.device_type),
    device_name  = coalesce(excluded.device_name, public.wifi_devices.device_name),
    hotspot_user = coalesce(excluded.hotspot_user, public.wifi_devices.hotspot_user),
    updated_at   = now()
  returning * into v_dev;

  return v_dev;
end;
$$;


ALTER FUNCTION "public"."wifi_upsert_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."wifi_upsert_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") IS 'UPSERT de device por (tenant_id, mac_address). Uso recomendado: backend/service role.';



CREATE TABLE IF NOT EXISTS "public"."platform_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_name" "text",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "module" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "target_label" "text",
    "tenant_id" "uuid",
    "tenant_name" "text",
    "result" "text" NOT NULL,
    "message" "text",
    "ip_address" "text",
    "user_agent" "text",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "meta" "jsonb",
    CONSTRAINT "platform_audit_logs_result_check" CHECK (("result" = ANY (ARRAY['success'::"text", 'warning'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."platform_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_settings" (
    "tenant_id" "uuid" NOT NULL,
    "brand_name" "text" DEFAULT ''::"text" NOT NULL,
    "logo_url" "text",
    "bg_image_url" "text",
    "bg_overlay_strength" integer DEFAULT 60 NOT NULL,
    "primary_color" "text" DEFAULT '#7c3aed'::"text" NOT NULL,
    "accent_color" "text" DEFAULT '#22c55e'::"text" NOT NULL,
    "headline" "text" DEFAULT 'Conecte-se ao Wi-Fi e receba benefícios'::"text" NOT NULL,
    "subheadline" "text" DEFAULT 'Preencha seus dados para liberar o acesso. Promoções são opcionais.'::"text" NOT NULL,
    "welcome_message" "text",
    "success_message" "text" DEFAULT 'Tudo certo! Liberando seu acesso…'::"text" NOT NULL,
    "error_message" "text" DEFAULT 'Não foi possível concluir. Tente novamente.'::"text" NOT NULL,
    "fields" "jsonb" DEFAULT '{"city": {"label": "Cidade", "enabled": true, "required": true}, "email": {"label": "Email", "enabled": true, "required": false}, "phone": {"label": "Telefone", "enabled": true, "required": false}, "full_name": {"label": "Nome", "enabled": true, "required": true}}'::"jsonb" NOT NULL,
    "terms_enabled" boolean DEFAULT true NOT NULL,
    "terms_title" "text" DEFAULT 'Termo de uso e privacidade'::"text" NOT NULL,
    "terms_body" "text" DEFAULT 'Ao continuar, você concorda com os termos de uso do Wi-Fi e com a política de privacidade do estabelecimento.'::"text" NOT NULL,
    "terms_required" boolean DEFAULT true NOT NULL,
    "splash_enabled" boolean DEFAULT false NOT NULL,
    "splash_title" "text" DEFAULT 'Novidade!'::"text" NOT NULL,
    "splash_message" "text" DEFAULT 'Confira nossos destaques de hoje antes de acessar o Wi-Fi.'::"text" NOT NULL,
    "splash_image_url" "text",
    "splash_cta_text" "text" DEFAULT 'Continuar'::"text" NOT NULL,
    "splash_cta_url" "text",
    "splash_dismiss_seconds" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "social_links" "jsonb" DEFAULT '[]'::"jsonb",
    "footer_text" "text",
    "bg_type" "text" DEFAULT 'image'::"text",
    "bg_color" "text" DEFAULT '#0f172a'::"text",
    "bg_video_url" "text",
    CONSTRAINT "portal_settings_bg_overlay_chk" CHECK ((("bg_overlay_strength" >= 0) AND ("bg_overlay_strength" <= 100))),
    CONSTRAINT "portal_settings_bg_type_check" CHECK (("bg_type" = ANY (ARRAY['color'::"text", 'image'::"text", 'video'::"text"]))),
    CONSTRAINT "portal_settings_splash_dismiss_chk" CHECK ((("splash_dismiss_seconds" >= 0) AND ("splash_dismiss_seconds" <= 60)))
);


ALTER TABLE "public"."portal_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."portal_settings" IS 'Configuração do Captive Portal por tenant (branding, campos, termo, splash). 1 linha por tenant.';



CREATE TABLE IF NOT EXISTS "public"."portal_unit_settings" (
    "unit_id" "uuid" NOT NULL,
    "brand_name" "text",
    "logo_url" "text",
    "bg_type" "text",
    "bg_image_url" "text",
    "bg_video_url" "text",
    "bg_color" "text",
    "bg_overlay_strength" integer,
    "primary_color" "text",
    "accent_color" "text",
    "headline" "text",
    "subheadline" "text",
    "welcome_message" "text",
    "success_message" "text",
    "error_message" "text",
    "fields" "jsonb",
    "terms_enabled" boolean,
    "terms_title" "text",
    "terms_body" "text",
    "terms_required" boolean,
    "splash_enabled" boolean,
    "splash_title" "text",
    "splash_message" "text",
    "splash_image_url" "text",
    "splash_cta_text" "text",
    "splash_cta_url" "text",
    "splash_dismiss_seconds" integer,
    "social_links" "jsonb",
    "footer_text" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "portal_unit_settings_bg_overlay_chk" CHECK ((("bg_overlay_strength" IS NULL) OR (("bg_overlay_strength" >= 0) AND ("bg_overlay_strength" <= 100)))),
    CONSTRAINT "portal_unit_settings_bg_type_check" CHECK ((("bg_type" IS NULL) OR ("bg_type" = ANY (ARRAY['color'::"text", 'image'::"text", 'video'::"text"])))),
    CONSTRAINT "portal_unit_settings_splash_dismiss_chk" CHECK ((("splash_dismiss_seconds" IS NULL) OR (("splash_dismiss_seconds" >= 0) AND ("splash_dismiss_seconds" <= 60))))
);


ALTER TABLE "public"."portal_unit_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "scope" "public"."user_scope" DEFAULT 'tenant'::"public"."user_scope" NOT NULL,
    "platform_role" "public"."platform_role",
    "status" "public"."user_status" DEFAULT 'pending'::"public"."user_status" NOT NULL,
    "is_platform_user" boolean DEFAULT false NOT NULL,
    "last_login_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "must_change_password" boolean DEFAULT true NOT NULL,
    "password_reset_required" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "job_title" "text",
    "department" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_financial" boolean DEFAULT false NOT NULL,
    "is_technical" boolean DEFAULT false NOT NULL,
    "is_operational" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_members" (
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."tenant_role" DEFAULT 'tenant_viewer'::"public"."tenant_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenant_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "slug" "text",
    "address_line" "text",
    "address_number" "text",
    "address_complement" "text",
    "district" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "country" "text" DEFAULT 'Brasil'::"text" NOT NULL,
    "phone" "text",
    "whatsapp" "text",
    "contact_email" "text",
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenant_units_name_chk" CHECK (("length"(TRIM(BOTH FROM "name")) >= 2)),
    CONSTRAINT "tenant_units_state_chk" CHECK ((("state" IS NULL) OR ("char_length"("state") = ANY (ARRAY[2, 3]))))
);


ALTER TABLE "public"."tenant_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "legal_name" "text",
    "document_number" "text",
    "phone" "text",
    "whatsapp" "text",
    "contact_email" "text",
    "address_line" "text",
    "address_number" "text",
    "address_complement" "text",
    "district" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "country" "text" DEFAULT 'Brasil'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unit_network_bindings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "binding_type" "text" NOT NULL,
    "binding_value" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unit_network_bindings_type_chk" CHECK (("binding_type" = ANY (ARRAY['ssid'::"text", 'nas_identifier'::"text", 'access_point'::"text", 'ip_address'::"text", 'mikrotik_router'::"text", 'controller_site'::"text"])))
);


ALTER TABLE "public"."unit_network_bindings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_platform_users" AS
 SELECT "p"."user_id",
    "p"."full_name",
    "p"."email",
    "p"."phone",
    "p"."scope",
    "p"."platform_role",
    "p"."status",
    "p"."is_platform_user",
    "p"."last_login_at",
    "p"."created_at",
    "count"("t"."id") FILTER (WHERE ("t"."id" IS NOT NULL)) AS "tenant_count",
    "string_agg"(DISTINCT "t"."name", ', '::"text") FILTER (WHERE ("t"."id" IS NOT NULL)) AS "tenant_names",
    COALESCE("json_agg"("json_build_object"('tenant_id', "t"."id", 'tenant_name', "t"."name", 'tenant_slug', "t"."slug", 'role', "tm"."role", 'is_active', "tm"."is_active")) FILTER (WHERE ("t"."id" IS NOT NULL)), '[]'::json) AS "memberships"
   FROM (("public"."profiles" "p"
     LEFT JOIN "public"."tenant_members" "tm" ON (("tm"."user_id" = "p"."user_id")))
     LEFT JOIN "public"."tenants" "t" ON (("t"."id" = "tm"."tenant_id")))
  GROUP BY "p"."user_id", "p"."full_name", "p"."email", "p"."phone", "p"."scope", "p"."platform_role", "p"."status", "p"."is_platform_user", "p"."last_login_at", "p"."created_at";


ALTER VIEW "public"."v_platform_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wifi_campaign_audiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "rules_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wifi_campaign_audiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wifi_campaign_coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "lead_id" "uuid",
    "redeemed" boolean DEFAULT false NOT NULL,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wifi_campaign_coupons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wifi_campaign_deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "device_id" "uuid",
    "delivery_channel" "text" DEFAULT 'portal'::"text" NOT NULL,
    "delivery_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "shown_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wifi_campaign_deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wifi_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "campaign_type" "text" DEFAULT 'portal'::"text",
    "audience_type" "text" DEFAULT 'all'::"text",
    "trigger_type" "text" DEFAULT 'manual'::"text",
    "coupon_code" "text",
    "discount_text" "text",
    "cta_label" "text",
    "cta_url" "text",
    "image_url" "text",
    "priority" integer DEFAULT 0,
    "subtitle" "text",
    "button_label" "text",
    "button_url" "text",
    "instagram_url" "text",
    "facebook_url" "text",
    "whatsapp_url" "text",
    "render_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "bg_color" "text",
    "text_color" "text",
    "button_bg_color" "text",
    "button_text_color" "text",
    "unit_id" "uuid",
    "timezone" "text",
    CONSTRAINT "wifi_campaigns_window_chk" CHECK ((("starts_at" IS NULL) OR ("ends_at" IS NULL) OR ("ends_at" >= "starts_at")))
);


ALTER TABLE "public"."wifi_campaigns" OWNER TO "postgres";


COMMENT ON TABLE "public"."wifi_campaigns" IS 'Tabela de campanhas do módulo WiFi Marketing. Armazena campanhas promocionais, informativas e de relacionamento vinculadas a cada tenant.';



COMMENT ON COLUMN "public"."wifi_campaigns"."id" IS 'Identificador único da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."tenant_id" IS 'Identificador do tenant/estabelecimento proprietário da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."title" IS 'Título ou nome interno da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."message" IS 'Mensagem principal da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."active" IS 'Indica se a campanha está ativa para uso/exibição';



COMMENT ON COLUMN "public"."wifi_campaigns"."starts_at" IS 'Data e hora de início da vigência da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."ends_at" IS 'Data e hora de término da vigência da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."created_at" IS 'Data de criação do registro';



COMMENT ON COLUMN "public"."wifi_campaigns"."updated_at" IS 'Data da última atualização do registro';



COMMENT ON COLUMN "public"."wifi_campaigns"."campaign_type" IS 'Tipo da campanha, ex.: portal, post_login, coupon, birthday, returning_customer, inactive_customer';



COMMENT ON COLUMN "public"."wifi_campaigns"."audience_type" IS 'Público-alvo da campanha, ex.: all, new_customers, returning_customers, inactive_30d, inactive_60d, birthday_month';



COMMENT ON COLUMN "public"."wifi_campaigns"."coupon_code" IS 'Código promocional opcional vinculado à campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."cta_label" IS 'Texto do botão de chamada para ação';



COMMENT ON COLUMN "public"."wifi_campaigns"."cta_url" IS 'URL de destino da chamada para ação';



COMMENT ON COLUMN "public"."wifi_campaigns"."image_url" IS 'Imagem ou banner opcional da campanha';



COMMENT ON COLUMN "public"."wifi_campaigns"."priority" IS 'Prioridade de exibição da campanha; valores maiores aparecem primeiro';



ALTER TABLE ONLY "public"."platform_audit_logs"
    ADD CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."portal_settings"
    ADD CONSTRAINT "portal_settings_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."portal_unit_settings"
    ADD CONSTRAINT "portal_unit_settings_pkey" PRIMARY KEY ("unit_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."tenant_contacts"
    ADD CONSTRAINT "tenant_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_units"
    ADD CONSTRAINT "tenant_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."unit_network_bindings"
    ADD CONSTRAINT "unit_network_bindings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_campaign_audiences"
    ADD CONSTRAINT "wifi_campaign_audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_campaign_coupons"
    ADD CONSTRAINT "wifi_campaign_coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_campaign_deliveries"
    ADD CONSTRAINT "wifi_campaign_deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_campaigns"
    ADD CONSTRAINT "wifi_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_devices"
    ADD CONSTRAINT "wifi_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_devices"
    ADD CONSTRAINT "wifi_devices_tenant_mac_uk" UNIQUE ("tenant_id", "mac_address");



ALTER TABLE ONLY "public"."wifi_leads"
    ADD CONSTRAINT "wifi_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wifi_sessions"
    ADD CONSTRAINT "wifi_sessions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_campaign_active_window" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "active", "starts_at", "ends_at");



CREATE INDEX "idx_logs_action" ON "public"."platform_audit_logs" USING "btree" ("action");



CREATE INDEX "idx_logs_actor" ON "public"."platform_audit_logs" USING "btree" ("actor_user_id");



CREATE INDEX "idx_logs_created_at" ON "public"."platform_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_logs_module" ON "public"."platform_audit_logs" USING "btree" ("module");



CREATE INDEX "idx_logs_result" ON "public"."platform_audit_logs" USING "btree" ("result");



CREATE INDEX "idx_logs_tenant" ON "public"."platform_audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_portal_settings_updated" ON "public"."portal_settings" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_portal_unit_settings_updated" ON "public"."portal_unit_settings" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_profiles_scope" ON "public"."profiles" USING "btree" ("scope");



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("status");



CREATE INDEX "idx_tenant_contacts_tenant" ON "public"."tenant_contacts" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_tenant_contacts_unit" ON "public"."tenant_contacts" USING "btree" ("unit_id", "is_active");



CREATE INDEX "idx_tenant_members_is_active" ON "public"."tenant_members" USING "btree" ("is_active");



CREATE INDEX "idx_tenant_members_tenant" ON "public"."tenant_members" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_members_tenant_id" ON "public"."tenant_members" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_members_user" ON "public"."tenant_members" USING "btree" ("user_id");



CREATE INDEX "idx_tenant_members_user_id" ON "public"."tenant_members" USING "btree" ("user_id");



CREATE INDEX "idx_tenant_units_tenant_active" ON "public"."tenant_units" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_tenant_units_tenant_id" ON "public"."tenant_units" USING "btree" ("tenant_id");



CREATE INDEX "idx_unit_network_bindings_lookup" ON "public"."unit_network_bindings" USING "btree" ("tenant_id", "binding_type", "binding_value");



CREATE INDEX "idx_unit_network_bindings_tenant_unit" ON "public"."unit_network_bindings" USING "btree" ("tenant_id", "unit_id");



CREATE INDEX "idx_wifi_campaigns_period" ON "public"."wifi_campaigns" USING "btree" ("starts_at", "ends_at");



CREATE INDEX "idx_wifi_campaigns_tenant_active" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "active", "created_at" DESC);



CREATE INDEX "idx_wifi_campaigns_tenant_period" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "starts_at", "ends_at");



CREATE INDEX "idx_wifi_campaigns_tenant_priority" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "priority" DESC, "created_at" DESC);



CREATE INDEX "idx_wifi_campaigns_tenant_unit_active" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "unit_id", "active", "created_at" DESC);



CREATE INDEX "idx_wifi_campaigns_tenant_unit_priority" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "unit_id", "priority" DESC, "created_at" DESC);



CREATE INDEX "idx_wifi_campaigns_tenant_window" ON "public"."wifi_campaigns" USING "btree" ("tenant_id", "starts_at" DESC, "ends_at" DESC);



CREATE INDEX "idx_wifi_devices_tenant_first_seen" ON "public"."wifi_devices" USING "btree" ("tenant_id", "first_seen" DESC);



CREATE INDEX "idx_wifi_devices_tenant_last_seen" ON "public"."wifi_devices" USING "btree" ("tenant_id", "last_seen" DESC);



CREATE INDEX "idx_wifi_devices_tenant_unit_last_seen" ON "public"."wifi_devices" USING "btree" ("tenant_id", "unit_id", "last_seen" DESC);



CREATE INDEX "idx_wifi_leads_tenant_campaign" ON "public"."wifi_leads" USING "btree" ("tenant_id", "campaign_id", "created_at" DESC);



CREATE INDEX "idx_wifi_leads_tenant_city" ON "public"."wifi_leads" USING "btree" ("tenant_id", "city");



CREATE INDEX "idx_wifi_leads_tenant_city_optin_created" ON "public"."wifi_leads" USING "btree" ("tenant_id", "city", "marketing_optin", "created_at" DESC);



CREATE INDEX "idx_wifi_leads_tenant_created_at" ON "public"."wifi_leads" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_wifi_leads_tenant_device" ON "public"."wifi_leads" USING "btree" ("tenant_id", "device_id");



CREATE INDEX "idx_wifi_leads_tenant_email" ON "public"."wifi_leads" USING "btree" ("tenant_id", "email");



CREATE INDEX "idx_wifi_leads_tenant_full_name" ON "public"."wifi_leads" USING "btree" ("tenant_id", "full_name");



CREATE INDEX "idx_wifi_leads_tenant_optin" ON "public"."wifi_leads" USING "btree" ("tenant_id", "marketing_optin", "created_at" DESC);



CREATE INDEX "idx_wifi_leads_tenant_unit_campaign" ON "public"."wifi_leads" USING "btree" ("tenant_id", "unit_id", "campaign_id", "created_at" DESC);



CREATE INDEX "idx_wifi_leads_tenant_unit_created_at" ON "public"."wifi_leads" USING "btree" ("tenant_id", "unit_id", "created_at" DESC);



CREATE INDEX "idx_wifi_sessions_open" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "login_time" DESC) WHERE ("logout_time" IS NULL);



CREATE INDEX "idx_wifi_sessions_tenant_device_login_time" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "device_id", "login_time" DESC);



CREATE INDEX "idx_wifi_sessions_tenant_login_time" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "login_time" DESC);



CREATE INDEX "idx_wifi_sessions_tenant_logout_time" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "logout_time" DESC);



CREATE INDEX "idx_wifi_sessions_tenant_mk_session" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "mikrotik_session_id");



CREATE INDEX "idx_wifi_sessions_tenant_unit_login_time" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "unit_id", "login_time" DESC);



CREATE INDEX "idx_wifi_sessions_tenant_unit_open" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "unit_id", "login_time" DESC) WHERE ("logout_time" IS NULL);



CREATE UNIQUE INDEX "uq_tenant_members_scope" ON "public"."tenant_members" USING "btree" ("tenant_id", "user_id", COALESCE("unit_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "role");



CREATE UNIQUE INDEX "uq_tenant_units_tenant_code" ON "public"."tenant_units" USING "btree" ("tenant_id", "code") WHERE (("code" IS NOT NULL) AND (TRIM(BOTH FROM "code") <> ''::"text"));



CREATE UNIQUE INDEX "uq_tenant_units_tenant_slug" ON "public"."tenant_units" USING "btree" ("tenant_id", "slug") WHERE (("slug" IS NOT NULL) AND (TRIM(BOTH FROM "slug") <> ''::"text"));



CREATE UNIQUE INDEX "ux_portal_settings_tenant" ON "public"."portal_settings" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "ux_wifi_sessions_one_open_per_device" ON "public"."wifi_sessions" USING "btree" ("tenant_id", "device_id") WHERE ("logout_time" IS NULL);



CREATE INDEX "wifi_leads_city" ON "public"."wifi_leads" USING "btree" ("tenant_id", "city");



CREATE UNIQUE INDEX "wifi_leads_email_day" ON "public"."wifi_leads" USING "btree" ("tenant_id", "email", "created_day") WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "wifi_leads_phone_day" ON "public"."wifi_leads" USING "btree" ("tenant_id", "phone", "created_day") WHERE (("phone" IS NOT NULL) AND ("phone" <> ''::"text"));



CREATE INDEX "wifi_leads_tenant_day" ON "public"."wifi_leads" USING "btree" ("tenant_id", "created_day" DESC);



CREATE INDEX "wifi_leads_tenant_slug" ON "public"."wifi_leads" USING "btree" ("tenant_slug");



CREATE OR REPLACE TRIGGER "trg_portal_settings_seed" AFTER INSERT ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."portal_settings_seed_for_tenant"();



CREATE OR REPLACE TRIGGER "trg_portal_settings_touch" BEFORE UPDATE ON "public"."portal_settings" FOR EACH ROW EXECUTE FUNCTION "public"."portal_settings_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_created_day" BEFORE INSERT ON "public"."wifi_leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_created_day"();



CREATE OR REPLACE TRIGGER "trg_tenant_members_updated_at" BEFORE UPDATE ON "public"."tenant_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wifi_campaigns_updated_at" BEFORE UPDATE ON "public"."wifi_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wifi_devices_updated_at" BEFORE UPDATE ON "public"."wifi_devices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wifi_leads_updated_at" BEFORE UPDATE ON "public"."wifi_leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wifi_sessions_updated_at" BEFORE UPDATE ON "public"."wifi_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."wifi_campaign_coupons"
    ADD CONSTRAINT "fk_coupon_tenant" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."portal_settings"
    ADD CONSTRAINT "portal_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_unit_settings"
    ADD CONSTRAINT "portal_unit_settings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_contacts"
    ADD CONSTRAINT "tenant_contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_contacts"
    ADD CONSTRAINT "tenant_contacts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_members"
    ADD CONSTRAINT "tenant_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_units"
    ADD CONSTRAINT "tenant_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_network_bindings"
    ADD CONSTRAINT "unit_network_bindings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_network_bindings"
    ADD CONSTRAINT "unit_network_bindings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_campaign_audiences"
    ADD CONSTRAINT "wifi_campaign_audiences_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."wifi_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_campaign_coupons"
    ADD CONSTRAINT "wifi_campaign_coupons_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."wifi_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_campaign_deliveries"
    ADD CONSTRAINT "wifi_campaign_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."wifi_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_campaigns"
    ADD CONSTRAINT "wifi_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_campaigns"
    ADD CONSTRAINT "wifi_campaigns_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_devices"
    ADD CONSTRAINT "wifi_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_devices"
    ADD CONSTRAINT "wifi_devices_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wifi_leads"
    ADD CONSTRAINT "wifi_leads_campaign_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."wifi_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wifi_leads"
    ADD CONSTRAINT "wifi_leads_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."wifi_devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_leads"
    ADD CONSTRAINT "wifi_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_leads"
    ADD CONSTRAINT "wifi_leads_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wifi_sessions"
    ADD CONSTRAINT "wifi_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."wifi_devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_sessions"
    ADD CONSTRAINT "wifi_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wifi_sessions"
    ADD CONSTRAINT "wifi_sessions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."tenant_units"("id") ON DELETE SET NULL;



CREATE POLICY "allow_insert_logs" ON "public"."platform_audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "platform_admin_read_logs" ON "public"."platform_audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."is_platform_user" = true) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role")))));



ALTER TABLE "public"."platform_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "portal_settings_admin_update" ON "public"."portal_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true) AND ("tm"."role" = 'tenant_admin'::"public"."tenant_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true) AND ("tm"."role" = 'tenant_admin'::"public"."tenant_role")))));



CREATE POLICY "portal_settings_insert_authenticated" ON "public"."portal_settings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "portal_settings_insert_by_tenant_member" ON "public"."portal_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true)))));



CREATE POLICY "portal_settings_member_select" ON "public"."portal_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true)))));



CREATE POLICY "portal_settings_no_delete" ON "public"."portal_settings" FOR DELETE TO "authenticated" USING (false);



CREATE POLICY "portal_settings_no_insert" ON "public"."portal_settings" FOR INSERT TO "authenticated" WITH CHECK (false);



CREATE POLICY "portal_settings_public_select" ON "public"."portal_settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "portal_settings_select_authenticated" ON "public"."portal_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "portal_settings_select_by_tenant_member" ON "public"."portal_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true)))));



CREATE POLICY "portal_settings_update_by_tenant_member" ON "public"."portal_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "portal_settings"."tenant_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true)))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK (("public"."is_super"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING (("public"."is_super"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE USING (("public"."is_super"() OR ("user_id" = "auth"."uid"()))) WITH CHECK (("public"."is_super"() OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."tenant_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_insert_platform_admin" ON "public"."tenants" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role") AND ("p"."status" = 'active'::"public"."user_status")))));



CREATE POLICY "tenants_select_members" ON "public"."tenants" FOR SELECT USING (("public"."is_super"() OR (EXISTS ( SELECT 1
   FROM "public"."tenant_members" "tm"
  WHERE (("tm"."tenant_id" = "tenants"."id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."is_active" = true))))));



CREATE POLICY "tenants_select_platform_admin" ON "public"."tenants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role") AND ("p"."status" = 'active'::"public"."user_status")))));



CREATE POLICY "tenants_select_super" ON "public"."tenants" FOR SELECT USING ("public"."is_super"());



CREATE POLICY "tenants_update_platform_admin" ON "public"."tenants" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role") AND ("p"."status" = 'active'::"public"."user_status"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role") AND ("p"."status" = 'active'::"public"."user_status")))));



CREATE POLICY "tenants_write_super" ON "public"."tenants" USING ("public"."is_super"()) WITH CHECK ("public"."is_super"());



CREATE POLICY "tm_select_self" ON "public"."tenant_members" FOR SELECT USING (("public"."is_super"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "tm_write_platform_admin" ON "public"."tenant_members" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."status" = 'active'::"public"."user_status") AND ("p"."is_platform_user" = true) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("p"."status" = 'active'::"public"."user_status") AND ("p"."is_platform_user" = true) AND ("p"."platform_role" = 'platform_admin'::"public"."platform_role")))));



ALTER TABLE "public"."wifi_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wifi_campaigns_delete" ON "public"."wifi_campaigns" FOR DELETE TO "authenticated" USING ("public"."is_tenant_admin"("tenant_id"));



CREATE POLICY "wifi_campaigns_insert" ON "public"."wifi_campaigns" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_marketing"("tenant_id"));



CREATE POLICY "wifi_campaigns_select" ON "public"."wifi_campaigns" FOR SELECT TO "authenticated" USING ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_campaigns_update" ON "public"."wifi_campaigns" FOR UPDATE TO "authenticated" USING ("public"."can_marketing"("tenant_id")) WITH CHECK ("public"."can_marketing"("tenant_id"));



ALTER TABLE "public"."wifi_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wifi_devices_delete" ON "public"."wifi_devices" FOR DELETE TO "authenticated" USING ("public"."is_tenant_admin"("tenant_id"));



CREATE POLICY "wifi_devices_insert" ON "public"."wifi_devices" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_devices_select" ON "public"."wifi_devices" FOR SELECT TO "authenticated" USING ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_devices_update" ON "public"."wifi_devices" FOR UPDATE TO "authenticated" USING ("public"."is_tenant_member"("tenant_id")) WITH CHECK ("public"."is_tenant_member"("tenant_id"));



ALTER TABLE "public"."wifi_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wifi_leads_delete" ON "public"."wifi_leads" FOR DELETE TO "authenticated" USING ("public"."is_tenant_admin"("tenant_id"));



CREATE POLICY "wifi_leads_insert" ON "public"."wifi_leads" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_leads_select" ON "public"."wifi_leads" FOR SELECT TO "authenticated" USING ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_leads_update" ON "public"."wifi_leads" FOR UPDATE TO "authenticated" USING ("public"."can_marketing"("tenant_id")) WITH CHECK ("public"."can_marketing"("tenant_id"));



ALTER TABLE "public"."wifi_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wifi_sessions_delete" ON "public"."wifi_sessions" FOR DELETE TO "authenticated" USING ("public"."is_tenant_admin"("tenant_id"));



CREATE POLICY "wifi_sessions_insert" ON "public"."wifi_sessions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_sessions_select" ON "public"."wifi_sessions" FOR SELECT TO "authenticated" USING ("public"."is_tenant_member"("tenant_id"));



CREATE POLICY "wifi_sessions_update" ON "public"."wifi_sessions" FOR UPDATE TO "authenticated" USING ("public"."is_tenant_member"("tenant_id")) WITH CHECK ("public"."is_tenant_member"("tenant_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."can_marketing"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_marketing"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_marketing"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_tenant_role"("p_tenant_id" "uuid", "p_roles" "public"."tenant_role"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_tenant_role"("p_tenant_id" "uuid", "p_roles" "public"."tenant_role"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_tenant_role"("p_tenant_id" "uuid", "p_roles" "public"."tenant_role"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tenant_admin"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tenant_admin"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tenant_admin"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_tenant_member"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_settings_seed_for_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_settings_seed_for_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_settings_seed_for_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."portal_settings_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."portal_settings_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."portal_settings_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_created_day"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_created_day"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_created_day"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_wifi_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_wifi_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_wifi_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_wifi_lead"("p_tenant_id" "uuid", "p_device_id" "uuid", "p_phone" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_full_name" "text", "p_city" "text", "p_tenant_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_wifi_lead"("p_tenant_id" "uuid", "p_device_id" "uuid", "p_phone" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_full_name" "text", "p_city" "text", "p_tenant_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_wifi_lead"("p_tenant_id" "uuid", "p_device_id" "uuid", "p_phone" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_full_name" "text", "p_city" "text", "p_tenant_slug" "text") TO "service_role";



GRANT ALL ON TABLE "public"."wifi_leads" TO "anon";
GRANT ALL ON TABLE "public"."wifi_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_leads" TO "service_role";



REVOKE ALL ON FUNCTION "public"."wifi_lead_capture"("p_tenant_id" "uuid", "p_mac_address" "text", "p_email" "text", "p_phone" "text", "p_full_name" "text", "p_city" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wifi_lead_capture"("p_tenant_id" "uuid", "p_mac_address" "text", "p_email" "text", "p_phone" "text", "p_full_name" "text", "p_city" "text", "p_marketing_optin" boolean, "p_source" "text", "p_campaign_id" "uuid", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") TO "service_role";



GRANT ALL ON TABLE "public"."wifi_sessions" TO "anon";
GRANT ALL ON TABLE "public"."wifi_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_sessions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."wifi_session_login"("p_tenant_id" "uuid", "p_mac_address" "text", "p_ip_address" "inet", "p_access_point" "text", "p_nas_identifier" "text", "p_mikrotik_session_id" "text", "p_auth_method" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text", "p_login_time" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wifi_session_login"("p_tenant_id" "uuid", "p_mac_address" "text", "p_ip_address" "inet", "p_access_point" "text", "p_nas_identifier" "text", "p_mikrotik_session_id" "text", "p_auth_method" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text", "p_login_time" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wifi_session_logout"("p_tenant_id" "uuid", "p_mac_address" "text", "p_logout_time" timestamp with time zone, "p_mikrotik_session_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wifi_session_logout"("p_tenant_id" "uuid", "p_mac_address" "text", "p_logout_time" timestamp with time zone, "p_mikrotik_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."wifi_stats"("p_tenant_id" "uuid", "p_from" "date", "p_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."wifi_stats"("p_tenant_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wifi_stats"("p_tenant_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



GRANT ALL ON TABLE "public"."wifi_devices" TO "anon";
GRANT ALL ON TABLE "public"."wifi_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_devices" TO "service_role";



REVOKE ALL ON FUNCTION "public"."wifi_upsert_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wifi_upsert_device"("p_tenant_id" "uuid", "p_mac_address" "text", "p_device_type" "text", "p_device_name" "text", "p_hotspot_user" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."platform_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."platform_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."portal_settings" TO "anon";
GRANT ALL ON TABLE "public"."portal_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_settings" TO "service_role";



GRANT ALL ON TABLE "public"."portal_unit_settings" TO "anon";
GRANT ALL ON TABLE "public"."portal_unit_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_unit_settings" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_contacts" TO "anon";
GRANT ALL ON TABLE "public"."tenant_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_members" TO "anon";
GRANT ALL ON TABLE "public"."tenant_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_members" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_units" TO "anon";
GRANT ALL ON TABLE "public"."tenant_units" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_units" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."unit_network_bindings" TO "anon";
GRANT ALL ON TABLE "public"."unit_network_bindings" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_network_bindings" TO "service_role";



GRANT ALL ON TABLE "public"."v_platform_users" TO "anon";
GRANT ALL ON TABLE "public"."v_platform_users" TO "authenticated";
GRANT ALL ON TABLE "public"."v_platform_users" TO "service_role";



GRANT ALL ON TABLE "public"."wifi_campaign_audiences" TO "anon";
GRANT ALL ON TABLE "public"."wifi_campaign_audiences" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_campaign_audiences" TO "service_role";



GRANT ALL ON TABLE "public"."wifi_campaign_coupons" TO "anon";
GRANT ALL ON TABLE "public"."wifi_campaign_coupons" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_campaign_coupons" TO "service_role";



GRANT ALL ON TABLE "public"."wifi_campaign_deliveries" TO "anon";
GRANT ALL ON TABLE "public"."wifi_campaign_deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_campaign_deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."wifi_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."wifi_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."wifi_campaigns" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



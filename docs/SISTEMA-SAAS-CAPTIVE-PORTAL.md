# Sistema SaaS de Captive Portal

## 1. Visao Geral

Este repositorio implementa um SaaS de Captive Portal com foco em:

- Captura de leads no momento de autenticacao Wi-Fi.
- Gestao multi-tenant (plataforma + area por estabelecimento).
- Integracao com Supabase (auth, tabelas e funcoes SQL).
- API em Cloudflare Workers para regras de negocio e integracao.

Arquitetura em alto nivel:

1. Frontend estatico (paginas HTML + JS em `assets/js`).
2. API edge em Cloudflare Worker (`src/index.ts`).
3. Dados e autenticacao no Supabase (`supabase/migrations`).

## 2. Estrutura do Projeto

### 2.1 Frontend (Pages/static)

- Portal publico de acesso Wi-Fi:
  - `index.html`
  - `success.html`
  - `termos.html`
  - `assets/js/app.js`
- Login e sessao:
  - `login.html`
  - `logout.html`
  - `assets/js/auth.js`
- Plataforma administrativa:
  - `platform.html`
  - `assets/js/platform.js`
  - `assets/js/platform-users.js`
- Area do estabelecimento:
  - `estabelecimento/index.html`
  - `estabelecimento/home.html`
  - `estabelecimento/clientes.html`
  - `estabelecimento/campanhas.html`
  - `estabelecimento/relatorios.html`
  - `estabelecimento/configuracoes.html`

### 2.2 Camada JS (modulos e servicos)

- Core:
  - `assets/js/core/supabase-client.js`
  - `assets/js/core/context-resolver.js`
  - `assets/js/core/permissions.js`
  - `assets/js/core/timezone.js`
  - `assets/js/core/utils.js`
- Servicos de dominio:
  - `assets/js/services/tenant-service.js`
  - `assets/js/services/lead-service.js`
  - `assets/js/services/campaign-service.js`
  - `assets/js/services/contact-service.js`
  - `assets/js/services/unit-service.js`
  - `assets/js/services/portal-service.js`
  - `assets/js/services/binding-service.js`

### 2.3 API (Cloudflare Worker)

- Entry point:
  - `src/index.ts`
- Configuracao:
  - `wrangler.jsonc`

Estado atual do Worker:

- Endpoint de health implementado em `/health`.
- Endpoint raiz implementado em `/`.
- Endpoints de negocio ainda devem ser implementados no Worker para cobrir todo o frontend.

### 2.4 Banco e Auth (Supabase)

- Configuracao local Supabase:
  - `supabase/config.toml`
- Schema/migration principal:
  - `supabase/migrations/20260331100845_remote_schema.sql`

Entidades importantes no schema:

- Multi-tenant e acesso:
  - `tenants`, `tenant_members`, `tenant_units`, `profiles`
- Portal/configuracao:
  - `portal_settings`, `portal_unit_settings`, `platform_settings`
- Captive portal e analytics:
  - `wifi_leads`, `wifi_sessions`, `wifi_devices`
  - `wifi_campaigns`, `wifi_campaign_audiences`, `wifi_campaign_coupons`, `wifi_campaign_deliveries`
  - `platform_audit_logs`, `tenant_contacts`, `unit_network_bindings`

Funcoes SQL de destaque:

- Captura e sessao:
  - `wifi_lead_capture`, `wifi_session_login`, `wifi_session_logout`, `wifi_stats`
- Regras e permissoes:
  - `has_tenant_role`, `is_tenant_admin`, `is_tenant_member`, `can_marketing`

## 3. Fluxos de Negocio

### 3.1 Captura no captive portal

1. Usuario abre o portal publico.
2. Frontend coleta dados basicos (nome, telefone, cidade, opt-in).
3. Frontend envia payload para API (`/lead`) definida em `assets/js/app.js`.
4. Em ambiente de teste, pode usar MAC fake quando `DEV_ALLOW_FAKE_MAC=true`.
5. Em cenario com hotspot, redireciona para autenticacao e depois `success.html`.

### 3.2 Painel administrativo

1. Usuario autentica via Supabase.
2. Frontend carrega tenant ativo (localStorage/contexto).
3. Paginas administrativas consultam API para clientes, campanhas, relatorios e dashboards.

## 4. Endpoints Esperados pelo Frontend

Chamadas encontradas no frontend (a serem atendidas pela API):

- `POST /lead`
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/leads`
- `GET /api/admin/reports/peak-hours`
- `GET/POST/PATCH/DELETE /api/admin/campaigns`

Observacao:

- No estado atual, o Worker implementa apenas `/` e `/health`.
- Os endpoints acima devem entrar no backlog de implementacao da API.

## 5. Configuracao de Ambientes (Wrangler)

Arquivo: `wrangler.jsonc`

Ambientes configurados:

- Default: `portalwifi-api`
- Dev: `portalwifi-api-dev`
- Prod: `portalwifi-api-prod`

Bindings/vars atuais:

- KV:
  - `DEDUP_KV`
  - `NONCES_KV`
- Vars:
  - `ALLOWED_ORIGINS`
  - `DEFAULT_CAMPAIGN_ID`
  - `DEV_ALLOW_FAKE_MAC`
  - `TENANT_ID`
- Secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `HMAC_SHARED_SECRET`

Comandos uteis:

```bash
# validar config sem publicar
npx wrangler deploy -e dev --dry-run
npx wrangler deploy -e prod --dry-run

# criar/deploy de ambiente
npx wrangler deploy -e dev
npx wrangler deploy -e prod

# cadastrar secret por ambiente
npx wrangler secret put SUPABASE_URL -e dev
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -e dev
npx wrangler secret put HMAC_SHARED_SECRET -e dev

npx wrangler secret put SUPABASE_URL -e prod
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -e prod
npx wrangler secret put HMAC_SHARED_SECRET -e prod
```

## 6. Operacao e Validacao

Checklist rapido:

1. Validar health da API:
   - `GET /health`
2. Confirmar secrets:
   - `npx wrangler secret list`
   - `npx wrangler secret list -e dev`
   - `npx wrangler secret list -e prod`
3. Testar fluxo portal:
   - envio de lead
   - redirecionamento hotspot
   - tela de sucesso
4. Testar area admin por tenant:
   - clientes
   - campanhas
   - relatorios

## 7. Backlog Tecnico Recomendado

1. Implementar no Worker os endpoints administrativos consumidos pelo frontend.
2. Padronizar autenticacao/autorizacao da API por perfil/tenant.
3. Adicionar testes de integracao para fluxos criticos (`lead`, dashboard, campanhas).
4. Versionar contratos de API (OpenAPI/Swagger).
5. Separar secrets e banco por ambiente dev/staging/prod.

## 8. Resumo Executivo

O projeto ja possui:

- Frontend funcional para portal e operacao administrativa.
- Modelo de dados robusto no Supabase para multi-tenant e analytics Wi-Fi.
- Worker configurado com secrets e ambientes.

Para fechar o ciclo de produto, o principal passo de engenharia agora e completar os endpoints de negocio da API no Worker para refletir as chamadas ja existentes no frontend.

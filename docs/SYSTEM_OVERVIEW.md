# System Overview

## Visao geral

O Nexora / Portal WiFi e um SaaS multi-tenant de captive portal com tres blocos tecnicos principais:

- frontend estatico em HTML, CSS e JavaScript vanilla;
- autenticacao e dados no Supabase;
- API edge em Cloudflare Workers.

O sistema atende hoje tres jornadas funcionais distintas, ainda com separacao incompleta na implementacao:

- portal publico de captura e autenticacao Wi-Fi;
- operacao administrativa global da plataforma SaaS;
- operacao administrativa do tenant.

## Estrutura principal

- `index.html`: roteador raiz que valida sessao e encaminha para `platform.html` ou `estabelecimento/index.html`.
- `login.html` e `logout.html`: autenticacao e encerramento de sessao no Supabase.
- `platform.html`: mock visual do admin global, sem o script funcional principal.
- `platform1.html`: pagina funcional do admin global, com `assets/js/platform.js`.
- `estabelecimento/*.html`: paginas operacionais do tenant.
- `assets/js`: scripts de pagina, modulos core e services.
- `src/index.ts`: Worker da API com apenas `/` e `/health` implementados.
- `supabase/migrations/20260331100845_remote_schema.sql`: schema principal, funcoes, views e policies.

## Componentes e camadas

### Frontend publico

- `index.html` e `assets/js/app.js`
- captura lead, registra device e inicia autenticacao hotspot
- `success.html` e `termos.html` complementam o fluxo publico

### Frontend administrativo global

- `platform1.html` + `assets/js/platform.js`
- gestao de tenants
- gestao de usuarios globais e vinculacoes com tenant
- logs de auditoria
- configuracoes globais
- suporte em estado preparatorio

### Frontend administrativo do tenant

- `assets/js/estabelecimento.js` foi construido para ser o shell do tenant com navegacao por iframe
- paginas existentes do tenant:
  - `estabelecimento/home.html`
  - `estabelecimento/clientes.html`
  - `estabelecimento/campanhas.html`
  - `estabelecimento/relatorios.html`
  - `estabelecimento/configuracoes.html`

### Core e servicos

- `assets/js/core/supabase-client.js`: inicializacao do cliente Supabase
- `assets/js/core/context-resolver.js`: resolve tenant, unidade e timezone
- `assets/js/core/timezone.js`: resolucao de timezone
- `assets/js/core/utils.js`: helpers genericos
- `assets/js/core/permissions.js`: arquivo vazio, sem centralizacao ativa de autorizacao
- `assets/js/services/tenant-service.js`, `unit-service.js`, `portal-service.js`: servicos ativos
- `assets/js/services/binding-service.js`, `contact-service.js`, `lead-service.js`, `session-service.js`: placeholders vazios

### Backend

- Worker edge em `src/index.ts`
- somente `/` e `/health` estao implementados
- o frontend espera endpoints adicionais sob `/api/admin/*` e `POST /lead`

## Entidades principais

- globais: `tenants`, `profiles`, `platform_settings`, `platform_audit_logs`, view `v_platform_users`
- tenant: `tenant_members`, `tenant_units`, `portal_settings`, `portal_unit_settings`, `tenant_contacts`, `unit_network_bindings`
- captive portal e analytics: `wifi_leads`, `wifi_devices`, `wifi_sessions`, `wifi_campaigns`, `wifi_campaign_*`

## Responsabilidades atuais

### Pertence claramente ao contexto global

- criacao e manutencao de tenants
- criacao e manutencao de usuarios globais
- logs de auditoria da plataforma
- configuracoes globais da plataforma

### Pertence claramente ao contexto do tenant

- configuracoes do portal
- campanhas
- clientes/leads
- relatorios operacionais
- configuracao de branding e formularios de captura

### Ja existe como camada transversal, mas sem modulo proprio

- health da API em `/health`
- metrica de sessoes, leads e autenticacoes no schema
- estrutura parcial para logs e auditoria

## Misturas indevidas observadas

- redirecionamentos do fluxo autenticado apontam para paginas que nao sao as paginas funcionais principais:
  - `index.html` e `assets/js/auth.js` apontam para `platform.html`, mas a pagina funcional com script e `platform1.html`
  - `index.html` e `assets/js/auth.js` apontam para `estabelecimento/index.html`, mas esse arquivo hoje contem uma copia de `login.html`
- o admin global mistura no mesmo modulo a administracao de usuarios globais com vinculos de tenant sem separar explicitamente dominio global de dominio local
- o tenant depende de `localStorage` e `sessionStorage` espalhados, sem um provider central de contexto
- parte do frontend usa Supabase direto e parte usa API externa, sem fronteira arquitetural consistente

## Riscos

- risco de quebra de navegacao por divergencia entre rotas apontadas e paginas funcionais
- risco de exposicao indevida de recursos globais ao tenant caso a separacao continue dependente apenas de condicoes de UI
- risco de manutencao alta por ausencia de camada central de permissao e contexto
- risco de inconsistencias futuras porque ha duplicidade de paginas e shells incompletos

## Oportunidades de modularizacao

- consolidar o admin global funcional em uma rota unica e estavel
- reconstruir o shell do tenant em `estabelecimento/index.html` reaproveitando `assets/js/estabelecimento.js`
- separar navegacao global, navegacao do tenant e observabilidade em grupos claros
- centralizar resolucao de contexto, roles e guards antes de expandir modulos

## Dependencias criticas para a etapa 2

- nao quebrar os contratos atuais com Supabase
- manter compatibilidade com `tenant_id`, `tenant_role` e chaves ja usadas no storage
- preservar as tabelas e policies atuais
- respeitar que o Worker ainda nao cobre todos os endpoints esperados pelo frontend

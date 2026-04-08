# Routes Current Map

## Rotas HTML atuais

### Rotas publicas

- `/`
  - roteador raiz autenticado
  - valida sessao e redireciona
- `/login.html`
  - login e signup
- `/logout.html`
  - logout
- `/index.html`
  - portal publico de captive portal
- `/success.html`
  - sucesso pos autenticacao
- `/termos.html`
  - termos e LGPD

### Rotas administrativas globais

- `/platform.html`
  - rota usada hoje pelos redirects
  - problema: pagina mock, nao a pagina funcional principal
- `/platform1.html`
  - pagina funcional do admin global

### Rotas administrativas do tenant

- `/estabelecimento/index.html`
  - rota usada hoje pelos redirects
  - problema: arquivo contem login, nao o shell do tenant
- `/estabelecimento/home.html`
- `/estabelecimento/clientes.html`
- `/estabelecimento/campanhas.html`
- `/estabelecimento/relatorios.html`
- `/estabelecimento/configuracoes.html`

## Rotas API observadas no frontend

- `POST /lead`
- `GET /api/admin/dashboard/summary`
- `GET /api/admin/leads`
- `GET /api/admin/reports/peak-hours`
- `GET /api/admin/campaigns`
- `POST /api/admin/campaigns`
- `PATCH /api/admin/campaigns/:id`
- `DELETE /api/admin/campaigns/:id`

## Rotas implementadas no Worker atual

- `GET /`
- `GET /health`

## Parametros de contexto usados

- `tenant`
- `tenant_id`
- `unit`
- `unit_id`
- `campaign_id`
- `link-login`
- `link-login-only`
- `dst`
- `ip`
- `mac`

## Dependencias criticas entre rotas

- `/` depende de `profiles` e `tenant_members` para escolher destino
- `/platform.html` deveria representar o admin global, mas hoje nao carrega o modulo funcional
- `/estabelecimento/index.html` deveria representar o shell tenant, mas hoje esta incorreto

## Rotas e compatibilidade

Para a etapa 2, a reorganizacao deve manter compatibilidade com:

- redirects existentes para `/platform.html`
- redirects existentes para `/estabelecimento/index.html`
- chamadas com query string de tenant
- chaves atuais de storage

## Riscos

- usuario global pode cair em tela sem logica operacional
- usuario tenant pode cair novamente em tela de login
- `_redirects` referencia `/dashboard.html`, arquivo inexistente no workspace atual

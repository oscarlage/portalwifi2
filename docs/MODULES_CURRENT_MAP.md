# Modules Current Map

## Modulos atuais por dominio

## Portal publico

### Captura e autenticacao

- `index.html`
- `assets/js/app.js`
- responsabilidade: capturar dados, montar payload, chamar `POST /lead`, iniciar autenticacao hotspot ou redirecionar para `success.html`

### Pos autenticacao

- `success.html`
- responsabilidade: feedback de sucesso ao usuario final

### Termos e LGPD

- `termos.html`
- responsabilidade: exibicao de termos

## Autenticacao administrativa

### Login e sessao

- `login.html`
- `logout.html`
- `assets/js/auth.js`
- `index.html`
- responsabilidade: autenticar, validar perfil, identificar escopo do usuario, redirecionar para global ou tenant

## Gestao global da plataforma

### Admin global funcional

- `platform1.html`
- `assets/js/platform.js`
- responsabilidade:
  - overview global
  - gestao de tenants
  - gestao de usuarios
  - logs globais
  - configuracoes globais
  - placeholder de suporte

### Mock global nao conectado

- `platform.html`
- responsabilidade: prototipo visual sem integracao ativa

## Gestao do tenant

### Shell esperado

- `assets/js/estabelecimento.js`
- responsabilidade: shell do workspace do tenant, troca de paginas, persistencia de pagina ativa, refletir tenant ativo no header

### Paginas do tenant

- `estabelecimento/home.html`
  - dashboard operacional
- `estabelecimento/clientes.html`
  - `assets/js/clientes.js`
  - consulta leads por tenant via API
- `estabelecimento/campanhas.html`
  - `assets/js/campanhas.js`
  - gestao de campanhas, preview e configuracao visual
- `estabelecimento/relatorios.html`
  - `assets/js/relatorios.js`
  - resumo operacional e horarios de pico
- `estabelecimento/configuracoes.html`
  - `assets/js/configuracoes.js`
  - branding, campos do formulario, links sociais e portal settings

## Core

- `assets/js/core/supabase-client.js`
- `assets/js/core/context-resolver.js`
- `assets/js/core/timezone.js`
- `assets/js/core/utils.js`
- `assets/js/core/permissions.js` vazio

## Services ativos

- `assets/js/services/tenant-service.js`
- `assets/js/services/unit-service.js`
- `assets/js/services/portal-service.js`

## Services placeholders

- `assets/js/services/binding-service.js`
- `assets/js/services/contact-service.js`
- `assets/js/services/lead-service.js`
- `assets/js/services/session-service.js`

## Modules experimentais

- `assets/js/modules/contacts-page.js`
- `assets/js/modules/portal-units-page.js`
- `assets/js/modules/units-page.js`

Esses modulos apontam para uma tentativa de evolucao para mais composicao, mas nao estao conectados ao fluxo principal atual.

## O que pode ser reaproveitado

- `platform.js` como base do futuro admin global
- `estabelecimento.js` como base do futuro shell do tenant
- `context-resolver.js`, `unit-service.js` e `portal-service.js`
- tabelas, enums, functions e policies do schema atual

## O que precisa ser separado

- usuarios globais versus usuarios locais
- configuracoes globais versus configuracoes do tenant
- observabilidade global versus relatorios operacionais do tenant

## O que precisa evoluir

- camada de permissao central
- servicos hoje vazios para leads, sessoes, bindings e contatos
- modulo transversal de saude e observabilidade

# Global Vs Tenant Analysis

## Resumo executivo

O projeto ja possui separacao conceitual no modelo de dados, mas a camada administrativa ainda nao comunica nem reforca essa separacao com clareza. O que hoje existe e uma divisao parcial:

- global: reconhecido por `is_platform_user` e `platform_role`;
- tenant: reconhecido por `tenant_members` e `tenant_role`;
- observabilidade: distribuida entre logs, health da API e dados analiticos, sem modulo proprio.

## O que hoje pertence a plataforma global

- cadastro e manutencao de tenants
- usuarios globais
- logs de auditoria da plataforma
- configuracoes globais
- preparacao para suporte global

## O que hoje pertence ao tenant

- branding do portal
- formulario de captura
- campanhas
- clientes/leads
- relatorios operacionais
- metricas de conexao e horarios de pico

## O que hoje esta misturado de forma inadequada

### Usuarios

`platform.js` trata numa mesma experiencia:

- usuarios globais da plataforma;
- usuarios locais vinculados a tenant;
- memberships e papeis locais.

### Rotas e shells

- `platform.html` e `platform1.html` dividem responsabilidade de um unico contexto global
- `estabelecimento/index.html` nao representa o contexto tenant esperado

### Observabilidade

- health da plataforma existe so no Worker
- logs estao no admin global
- metricas de uso estao espalhadas no tenant
- nao ha um dominio consolidado de saude operacional

## O que pode ser reaproveitado

- schema atual e policies
- `platform.js` como base do admin global real
- `estabelecimento.js` como base do shell tenant
- servicos de `tenant`, `unit` e `portal`
- dados de auditoria e analytics ja existentes

## O que precisa ser separado estruturalmente

### Camada 1: Gestao da Plataforma Nexora

- dashboard global da plataforma
- tenants
- usuarios globais
- acessos globais
- logs globais
- suporte
- observabilidade e saude
- configuracoes globais

### Camada 2: Gestao do Tenant

- dashboard do tenant
- branding e portal
- campanhas
- leads
- usuarios locais
- unidades e hotspots
- configuracoes do tenant
- relatorios e metricas do tenant

### Camada 3: Saude / Observabilidade

- modulo interno ao admin global
- health score da plataforma
- saude dos tenants
- sessoes e autenticacoes
- radius
- banco
- alertas e incidentes

## Proposta objetiva de separacao para a etapa 2

- consolidar uma rota global funcional unica, mantendo compatibilidade com `/platform.html`
- reconstruir o shell do tenant em `/estabelecimento/index.html`, mantendo compatibilidade com os redirects atuais
- reorganizar o menu global em grupos:
  - operacao global
  - identidade e acessos globais
  - observabilidade e saude
  - configuracoes
- mover gestao de usuarios locais para o contexto do tenant ou, no minimo, separar a experiencia visual e os filtros por escopo
- manter services compartilhados em camada comum e desacoplar tela de regra de negocio onde a base ja existe

## Riscos residuais mapeados antes da modularizacao

- endpoints administrativos ainda nao existem no Worker atual
- parte do tenant depende de API externa fixa
- alguns servicos ainda sao placeholders vazios
- existem artefatos antigos ou prototipos que confundem o fluxo real

## Cuidados obrigatorios para a etapa 2

- nao apagar `platform.html` nem quebrar redirects existentes; usar compatibilidade temporaria
- nao alterar contratos do Supabase sem necessidade
- introduzir separacao de contexto primeiro no layout e na navegacao, depois na organizacao interna dos modulos

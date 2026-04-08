# Target Architecture

## Objetivo

Consolidar tres camadas administrativas claras sem quebrar compatibilidade:

- Gestao da Plataforma Nexora
- Gestao do Tenant
- Saude / Observabilidade

## Arquitetura alvo

### Camada 1: Gestao Global Nexora

- shell global funcional em `platform1.html`
- rota de compatibilidade em `platform.html`
- agrupamento de menus globais por dominio
- administracao central de tenants, acessos globais, logs, configuracoes e suporte

### Camada 2: Gestao do Tenant

- shell do tenant restaurado em `estabelecimento/index.html`
- navegacao interna controlada por `assets/js/estabelecimento.js`
- paginas de tenant mantidas em `estabelecimento/*.html`

### Camada 3: Observabilidade

- modulo embutido dentro do admin global
- fonte principal de agregacao em `assets/js/services/platform-health.js`
- separacao entre coleta, calculo e apresentacao

## Compatibilidade preservada

- `platform.html` continua sendo o entrypoint conhecido, agora redirecionando para o shell global funcional
- `estabelecimento/index.html` continua sendo o destino do tenant, agora com a shell correta
- `dashboard.html` foi criado para cobrir o `_redirects`

## Dependencias criticas mantidas

- Supabase Auth
- schema e policies atuais
- chaves de storage ja usadas no projeto
- `platform.js` e `estabelecimento.js` como bases reaproveitadas

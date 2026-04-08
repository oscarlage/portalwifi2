# Auth And Access Map

## Autenticacao atual

- Supabase Auth e a fonte de identidade
- `login.html` faz `signInWithPassword` e `signUp`
- `index.html` valida sessao e decide o destino do usuario
- `logout.html` e os fluxos de logout limpam sessao e storage relacionado ao tenant

## Determinacao de acesso

### Nivel de perfil

A tabela `profiles` define:

- `status`
- `scope`
- `is_platform_user`
- `platform_role`

### Nivel de tenant

A tabela `tenant_members` define:

- `tenant_id`
- `role`
- `is_active`

## Papeis identificados no schema

### Globais

- `platform_admin`
- `platform_support`
- `platform_operations`
- `platform_readonly`

### Tenant

- `tenant_admin`
- `tenant_viewer`
- `tenant_marketing`

## Regras atuais observadas

### Frontend

- se `profile.is_platform_user === true`, redireciona para area global
- caso contrario, busca um membership ativo e redireciona para area do tenant
- `platform.js` bloqueia acesso de usuarios nao globais
- scripts do tenant dependem do tenant ativo no storage

### Banco / SQL

Funcoes importantes:

- `is_super()`
- `is_tenant_member(p_tenant_id)`
- `is_tenant_admin(p_tenant_id)`
- `has_tenant_role(p_tenant_id, p_roles)`
- `can_marketing(p_tenant_id)`

Policies relevantes:

- `tenants_select_platform_admin`
- `tenants_update_platform_admin`
- `tm_write_platform_admin`
- policies de leitura e escrita para `wifi_campaigns`, `wifi_leads`, `wifi_sessions`, `wifi_devices`
- policies especificas para `portal_settings`
- leitura de `platform_audit_logs` para admin global

## Riscos atuais de seguranca e permissao

- `assets/js/core/permissions.js` esta vazio, entao nao existe centralizacao no frontend
- a navegacao ainda depende muito de hardcoded redirects e validacoes por pagina
- o modulo global de usuarios mistura papeis globais e locais, o que aumenta risco de erro operacional
- `_redirects` e rotas HTML estao inconsistentes, o que pode causar entradas em telas erradas

## Ponto positivo

O schema ja oferece uma base solida para separar acesso global e acesso do tenant sem migracoes destrutivas.

## Cuidados para a etapa 2

- criar guards de contexto global e tenant
- separar claramente telas e menus por escopo
- impedir que usuarios tenant vejam entradas globais mesmo por navegacao manual
- manter RLS e validacao de papel como fonte real de autorizacao

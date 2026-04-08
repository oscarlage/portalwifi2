# Menu Current Map

## Menu global funcional atual

Fonte principal: `platform1.html`.

### Itens atuais

- `Visao geral`
- `Tenants`
- `Usuarios`
- `Logs`
- `Configuracoes`
- `Suporte`

### Classificacao correta

- globais:
  - `Visao geral`
  - `Tenants`
  - `Logs`
  - `Configuracoes`
  - `Suporte`
- misto ou mal posicionado:
  - `Usuarios`

## Por que `Usuarios` esta misturado

O modulo atual de usuarios no admin global administra ao mesmo tempo:

- usuarios estritamente globais;
- usuarios de tenant;
- vinculos tenant_members;
- papeis globais e papeis locais.

Funcionalmente isso atende a operacao, mas arquiteturalmente mistura:

- identidade global da plataforma;
- acesso local do tenant.

## Menu tenant esperado

Fonte principal: `assets/js/estabelecimento.js`.

### Itens previstos pelo script

- `Dashboard`
- `Clientes`
- `Campanhas`
- `Configuracoes`
- `Relatorios`

### Classificacao correta

- tenant:
  - `Dashboard`
  - `Clientes`
  - `Campanhas`
  - `Configuracoes`
  - `Relatorios`

## Problema atual do menu tenant

- o shell que deveria renderizar esse menu nao esta presente em `estabelecimento/index.html`
- as paginas existem, mas a experiencia de navegacao integrada do tenant esta quebrada ou incompleta

## Menus ausentes, mas necessarios

### Gestao global da plataforma

- Observabilidade / Saude
- Incidentes e alertas
- Integracoes globais
- Usuarios globais separados de acessos locais

### Gestao do tenant

- Unidades / hotspots / SSIDs
- Usuarios locais
- Perfis locais e acessos
- Metricas do tenant

## Dependencias entre paginas

- `Tenants` do admin global precisa abrir o workspace do tenant
- `Usuarios` depende de tenants para vinculo e filtro
- paginas do tenant dependem do tenant ativo persistido em storage

## Cuidados para a etapa 2

- separar menu global e menu tenant visualmente e logicamente
- evitar que qualquer item global apareca no workspace do tenant
- manter deep links e compatibilidade de redirecionamento

# Architecture Current State

## Panorama

O estado atual da arquitetura e hibrido:

- o dominio multi-tenant esta bem modelado no banco;
- o frontend administrativo foi separado conceitualmente em global e tenant;
- a implementacao de navegacao, layout e rotas ainda nao consolidou essa separacao.

## Camadas atuais

### Apresentacao

- aplicacao multipage tradicional
- JS vanilla com IIFEs e scripts por pagina
- ausencia de router client-side central
- ausencia de componentes compartilhados formalizados

### Aplicacao

- parte da regra esta dentro dos scripts de pagina
- servicos utilitarios existem, mas cobrem so parte dos casos
- nao ha camada unica de guards de acesso

### Dados

- Supabase com schema relativamente robusto
- RLS e funcoes SQL para isolamento por tenant
- view `v_platform_users` para consolidacao de usuarios e memberships

### Integracao

- Cloudflare Worker configurado, mas com cobertura de API incompleta
- frontend tenant depende de endpoints `GET /api/admin/*` ainda nao implementados no Worker atual

## Estrutura de diretorios

### Frontend raiz

- `index.html`
- `login.html`
- `logout.html`
- `platform.html`
- `platform1.html`
- `success.html`
- `termos.html`

### Frontend tenant

- `estabelecimento/*.html`

### Scripts

- `assets/js/*.js`
- `assets/js/core/*`
- `assets/js/services/*`
- `assets/js/modules/*`

### Backend e dados

- `src/index.ts`
- `supabase/config.toml`
- `supabase/migrations/*.sql`

## Layouts atuais

### Layout raiz

- pagina simples de roteamento/autenticacao
- sem menu
- apenas validacao de sessao e redirect

### Layout global funcional

- `platform1.html`
- sidebar unica com secoes `Visao geral`, `Tenants`, `Usuarios`, `Logs`, `Configuracoes`, `Suporte`
- modais de tenant e usuario no mesmo documento
- controlado por `platform.js`

### Layout global nao funcional

- `platform.html`
- mock visual premium
- nao referencia `platform.js`
- nao participa do fluxo de dados atual

### Layout tenant esperado

- `assets/js/estabelecimento.js` espera um shell com:
  - botoes `.nav-item`
  - `#contentFrame`
  - `#pageTitle`
  - `#pageSubtitle`
  - elementos de tenant no header e footer

### Layout tenant real hoje

- `estabelecimento/index.html` contem conteudo de login, nao o shell esperado
- as paginas internas do tenant existem, mas o shell que deveria carrega-las esta ausente

## Reuso e acoplamento

### Reuso existente

- servicos de tenant, unidade e portal
- helpers de contexto e timezone
- tabela/view unificadas para usuarios e memberships

### Acoplamentos atuais

- scripts de pagina manipulam diretamente Supabase e DOM
- tenant context e mantido via `localStorage` e `sessionStorage` distribuido em multiplos scripts
- redirecionamentos de auth estao hardcoded

## Pontos de mistura indevida

- gestao de usuarios globais e locais no mesmo modulo de usuarios do admin global
- configuracao de tenant e configuracao global usam abordagens diferentes, sem uma taxonomia unica
- observabilidade existe apenas de forma fragmentada entre health do Worker, logs globais e tabelas analiticas

## Riscos arquiteturais

- divergencia entre rota apontada e pagina funcional
- dependencia de paginas duplicadas ou placeholder
- dificuldade de ampliar permissao por papel sem uma camada comum

## Cuidados para a etapa 2

- manter o modelo de dados atual como fonte de verdade
- evitar renomear tabelas, enums ou chaves de storage
- introduzir compatibilidade temporaria onde houver rotas antigas em uso

# Design System Nexora

## Objetivo

Unificar a interface do ecossistema Nexora em um único padrão visual claro, com leitura rápida, aparência SaaS enterprise e consistência entre o Command Center global, o Tenant Workspace e os fluxos públicos de autenticação.

## Arquivos Centrais

- `assets/css/tokens.css`: tokens globais de cor, tipografia, borda, sombra, raio e espaçamento.
- `assets/css/theme.css`: componentes base reutilizáveis e comportamentos compartilhados.
- `assets/css/public-ui.css`: camada pública para login, logout, reset de senha, suporte e roteamento.

## Tokens Principais

### Cores

- `--ds-bg-main`: fundo principal da aplicação.
- `--ds-bg-subtle`: fundo secundário para áreas de respiro.
- `--ds-bg-card`: superfície principal dos cards.
- `--ds-bg-card-alt`: superfície secundária para blocos internos.
- `--ds-border`: borda padrão.
- `--ds-border-strong`: borda de destaque.
- `--ds-text-primary`: texto principal.
- `--ds-text-secondary`: texto de apoio.
- `--ds-text-tertiary`: texto auxiliar.
- `--ds-color-primary`: cor primária da marca.
- `--ds-color-primary-hover`: estado hover da primária.
- `--ds-color-primary-soft`: fundo suave associado à primária.
- `--ds-color-success`: sucesso.
- `--ds-color-warning`: alerta.
- `--ds-color-danger`: erro.

### Tipografia

- Fonte base: `Inter`.
- Peso padrão de texto: `400`.
- Peso de labels e subtítulos: `600` ou `700`.
- Peso de métricas e títulos principais: `800`.

### Espaçamento

- Espaçamento interno de cards: entre `16px` e `24px`.
- Espaçamento entre blocos: entre `16px` e `24px`.
- Gap de grids de métricas e painéis: `16px` a `20px`.

### Sombra e Bordas

- Sombra padrão: `--ds-shadow-md`.
- Card premium: fundo branco, borda leve e sombra suave.
- Cantos: `12px`, `16px`, `20px` e `24px` conforme hierarquia.

## Componentes Base

### Layout

- `sidebar`
- `topbar`
- `platform-shell`
- `app-shell`
- `frame-wrap`

### Superfícies

- `card`
- `panel-card`
- `metric-card`
- `form-section`
- `section-block`

### Ações

- `btn`
- `btn-primary`
- `btn-light`
- `btn-secondary`
- `btn-dark`
- `btn-danger`
- `btn-sm`
- `ghost`

### Estado

- `badge`
- `pill`
- `session-pill`
- `score-pill`
- `status-badge`

### Formulários

- `field`
- `input`
- `select`
- `textarea`
- `form-grid`
- `grid-1`
- `grid-2`

### Dados

- `table-wrap`
- `data-table`
- `empty-row`

### Overlay

- `modal-backdrop`
- `modal`
- `modal-head`
- `modal-body`
- `modal-foot`

## Regras de Uso

- Sempre reutilizar tokens globais para novas cores.
- Sempre priorizar `card`, `panel-card` e `metric-card` para superfícies.
- Sempre usar `btn-*` padronizados para ações.
- Sempre manter contraste alto entre texto e fundo.
- Sempre preferir bordas leves e sombras sutis a contrastes agressivos.
- Sempre manter badges com altura visual consistente e leitura imediata.

## O Que Não Fazer

- Não introduzir novos temas escuros paralelos.
- Não criar novos hexadecimais arbitrários sem passar pelos tokens.
- Não duplicar estilos de botão, badge, tabela ou modal por página.
- Não usar fundo escuro em páginas de gestão global ou tenant.
- Não misturar variantes visuais conflitantes para o mesmo componente.

## Observações de Migração

- `platform.css` já era a referência mais próxima do padrão alvo.
- `estabelecimento.css` foi trazido para o mesmo eixo visual do global.
- `styles.css` deixou de ser um tema escuro isolado e passou a usar a base clara comum.
- Páginas com CSS inline de autenticação migraram para `public-ui.css`.
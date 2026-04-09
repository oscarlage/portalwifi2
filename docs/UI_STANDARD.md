# UI Standard

## Princípios

- Fundo claro e baixa carga visual.
- Hierarquia visual imediata.
- Componentes estáveis entre contexto global e tenant.
- Aparência premium com sobriedade enterprise.
- Leitura rápida em dashboards, tabelas e formulários.

## Padrão de Layout

### Sidebar

- Fundo branco ou branco translúcido.
- Borda lateral sutil.
- Item ativo com fundo suave da cor primária.
- Hover discreto, sem contraste pesado.

### Header

- Fundo claro.
- Título principal forte.
- Subtítulo curto e cinza.
- Ações agrupadas com variantes padronizadas de botão.

### Conteúdo

- Fundo geral claro com leve nuance azulada.
- Painéis em branco.
- Grids com espaçamento estável.
- Tabelas em superfície branca com cabeçalho suave.

## Padrão de Componentes

### Cards

- Branco.
- Borda leve.
- Sombra suave.
- Cantos arredondados.
- Padding padrão entre `16px` e `24px`.

### KPIs

- Label pequena e discreta.
- Valor grande, forte e escaneável.
- Sem excesso de ornamento.

### Botões

- Primário: azul Nexora.
- Secundário/light: branco com borda clara.
- Dark: reservado para ações de saída ou contraste funcional.
- Danger: vermelho suave e controlado.

### Badges

- Formato pill.
- Texto centralizado verticalmente.
- Padding horizontal pequeno.
- Cor sem saturação agressiva.

### Inputs

- Fundo branco.
- Borda clara.
- Foco com halo suave na cor primária.
- Labels com peso 700 e tamanho reduzido.

### Tabelas

- Wrapper com borda e raio.
- Cabeçalho com fundo suave.
- Hover discreto por linha.
- Estado vazio centralizado.

## Compatibilidade

- `platform.html` e `dashboard.html` permanecem como rotas de compatibilidade.
- `platform2.html` é artefato experimental/legado e não é a referência atual do design system.

## Pendências Conhecidas

- `estabelecimento/campanhas.html` ainda possui bloco de estilo inline próprio que deve ser absorvido futuramente pelo CSS compartilhado.
- `platform2.html` usa Tailwind inline e permanece fora da trilha principal de produção.
# Navigation Reorganization

## Antes

- `platform.html` era um mock desacoplado
- `platform1.html` era o shell funcional real
- `estabelecimento/index.html` estava incorreto
- menus global e tenant nao comunicavam claramente os contextos

## Depois

### Global

- `platform.html` virou compatibilidade de rota
- `platform1.html` passou a exibir grupos de menu por dominio
- o menu global agora separa operacao da plataforma de operacoes & saude

### Tenant

- `estabelecimento/index.html` virou a shell operacional do tenant
- o header do tenant deixa explicito o contexto local
- a navegacao interna continua por iframe, preservando as paginas existentes

## Resultado

- menos ambiguidade de contexto
- preservacao dos destinos antigos
- base preparada para evolucao gradual sem refatoracao destrutiva

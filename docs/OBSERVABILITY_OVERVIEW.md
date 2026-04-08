# Observability Overview

## Escopo

O modulo de observabilidade foi criado dentro do admin global para consolidar sinais de:

- health da API
- estado do banco
- saude dos tenants
- sessoes e autenticacoes
- metricas do captive portal
- alertas e incidentes

## Implementacao

- coleta e agregacao em `assets/js/services/platform-health.js`
- apresentacao em secoes dedicadas do `platform1.html`
- renderizacao controlada por `assets/js/platform.js`

## Limitacoes atuais

- consultas a `wifi_*` podem ser limitadas por RLS para o papel autenticado
- RADIUS ainda e um modulo preparado, nao integrado a uma telemetria dedicada
- parte dos indicadores usa proxy seguro ou placeholder documentado

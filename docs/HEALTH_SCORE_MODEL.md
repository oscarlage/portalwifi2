# Health Score Model

## Formula inicial

O score implementado em `assets/js/services/platform-health.js` considera:

- disponibilidade: 25%
- sucesso de autenticação: 20%
- latência: 15%
- falhas: 15%
- atividade recente: 10%
- serviços críticos: 15%

## Faixas

- `85-100`: saudável
- `65-84`: degradado
- `0-64`: crítico

## Características do modelo

- centralizado
- ajustável
- tolerante à ausência parcial de dados
- preparado para substituir proxies por telemetria real

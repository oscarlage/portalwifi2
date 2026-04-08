# Modularization Decisions

## Decisoes principais

1. Reaproveitar `platform.js` e `estabelecimento.js` em vez de iniciar novos shells.
2. Manter compatibilidade por redirecionamento em `platform.html`.
3. Restaurar `estabelecimento/index.html` como shell do tenant.
4. Introduzir observabilidade por service dedicado em `assets/js/services/platform-health.js`.
5. Separar visualmente usuarios globais e acessos locais sem quebrar o fluxo operacional atual.
6. Criar `dashboard.html` para atender o `_redirects` existente.
7. Criar `support.html` como rota de compatibilidade para suporte global.

## Decisoes adiadas

- mover completamente o shell global para `platform.html`
- migrar toda a UI para modules ES nativos
- centralizar permissao no arquivo `assets/js/core/permissions.js`
- implementar backend dedicado para observabilidade e RADIUS

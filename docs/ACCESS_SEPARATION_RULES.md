# Access Separation Rules

## Regras aplicadas

- o admin global permanece no shell `platform1.html`
- o tenant permanece isolado em `estabelecimento/index.html`
- o modulo `Identidade & acessos` agora separa visualmente usuarios globais de acessos locais

## Regras de fronteira

- usuario global opera tenants e configuracoes centrais
- usuario tenant opera exclusivamente o workspace local
- observabilidade fica sob o contexto global

## Fonte de verdade

- `profiles.is_platform_user`
- `profiles.platform_role`
- `tenant_members.role`
- policies e funcoes SQL do schema atual

# portalwifi2

SaaS de Captive Portal para captura de leads, autenticacao Wi-Fi e operacao multi-tenant.

## Documentacao

- Visao completa do sistema: `docs/SISTEMA-SAAS-CAPTIVE-PORTAL.md`

## Stack

- Frontend estatico (HTML, CSS, JS)
- Supabase (Auth + Postgres)
- Cloudflare Workers (API)
- Cloudflare Pages (hosting frontend)

## Comandos uteis

```bash
# Deploy do worker padrao
npx wrangler deploy

# Dry-run por ambiente
npx wrangler deploy -e dev --dry-run
npx wrangler deploy -e prod --dry-run

# Listar secrets
npx wrangler secret list
npx wrangler secret list -e dev
npx wrangler secret list -e prod
```
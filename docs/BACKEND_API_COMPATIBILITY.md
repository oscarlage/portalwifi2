# Backend API Compatibility

Este documento registra os endpoints atualmente expostos pelo Worker em [src/index.ts](src/index.ts) para manter compatibilidade com o frontend administrativo e com o captive portal.

## Endpoints implementados

### `GET /health`

Retorna status básico do Worker e a presença das secrets necessárias.

Resposta:

```json
{
  "ok": true,
  "service": "portalwifi-api",
  "secrets": {
    "supabaseUrl": true,
    "supabaseServiceRoleKey": true,
    "hmacSharedSecret": false
  },
  "now": "2026-04-08T12:00:00.000Z"
}
```

### `POST /lead`

Compatível com [assets/js/app.js](assets/js/app.js). Resolve o tenant por `tenant_id` ou `tenant_slug`, faz UPSERT do device por MAC e captura/deduplica o lead via RPC do Supabase.

Payload esperado:

```json
{
  "full_name": "Cliente Exemplo",
  "phone": "11999999999",
  "city": "Sao Paulo",
  "marketing_optin": true,
  "source": "portal",
  "tenant_slug": "tenant-demo",
  "campaign_id": null,
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "device_name": "ua:..."
}
```

Resposta:

```json
{
  "ok": true,
  "lead_id": "uuid",
  "inserted": true,
  "deduped": false,
  "tenant_id": "uuid"
}
```

### `GET /api/admin/leads`

Compatível com [assets/js/clientes.js](assets/js/clientes.js).

Query params:

- `tenant_id` ou `tenant_slug`

Resposta:

```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "full_name": "Cliente Exemplo",
      "phone": "11999999999",
      "city": "Sao Paulo",
      "created_at": "2026-04-08T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/admin/dashboard/summary`

Compatível com [assets/js/relatorios.js](assets/js/relatorios.js).

Query params:

- `tenant_id` ou `tenant_slug`
- `period`: `today`, `7d`, `30d`, `month`, `custom`
- `date_from`, `date_to` quando `period=custom`

Resposta:

```json
{
  "ok": true,
  "summary": {
    "connected": 42,
    "new_customers": 18,
    "returning_customers": 7,
    "marketing_optin": 11
  }
}
```

### `GET /api/admin/reports/peak-hours`

Compatível com [assets/js/relatorios.js](assets/js/relatorios.js).

Query params:

- `tenant_id` ou `tenant_slug`
- `period`: `today`, `7d`, `30d`, `month`, `custom`
- `date_from`, `date_to` quando `period=custom`
- `hour_from`, `hour_to`

Resposta:

```json
{
  "ok": true,
  "hours": [
    { "label": "08h", "value": 3 },
    { "label": "09h", "value": 7 }
  ]
}
```

### `GET /api/admin/campaigns`

Compatível com [assets/js/campanhas.js](assets/js/campanhas.js).

Query params:

- `tenant_id` ou `tenant_slug`

Retorna array simples de campanhas, preservando o formato esperado pelo frontend.

### `POST /api/admin/campaigns`

Cria campanha no schema `wifi_campaigns` com os campos usados pelo formulário do tenant admin.

### `PUT /api/admin/campaigns/:id`

Atualiza a campanha informada.

### `DELETE /api/admin/campaigns/:id`

Remove a campanha por `id`. O frontend atual não envia `tenant_id` no `DELETE`, então a exclusão usa apenas o UUID da campanha.

## Observações

- O Worker usa `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para falar com o PostgREST e com as RPCs existentes.
- A captura de lead reaproveita as funções `wifi_upsert_device` e `upsert_wifi_lead` já presentes no banco.
- O resumo do dashboard mistura `wifi_stats` com agregações de `wifi_sessions` para manter compatibilidade imediata com o frontend atual.
- Os endpoints retornam CORS aberto para suportar Cloudflare Pages e shells HTML estáticos.

## Limites atuais

- `returning_customers` é calculado por devices com sessão no período e histórico anterior em `wifi_sessions`.
- `peak-hours` agrupa por hora UTC do campo `login_time`; se o produto exigir timezone do tenant, o próximo ajuste deve considerar `tenants.timezone`.
- Não foi adicionada autenticação explícita no Worker nesta etapa; o objetivo aqui foi compatibilidade operacional com o frontend já existente.
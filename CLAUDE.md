# CLAUDE.md

## Project Overview

This is an MCP (Model Context Protocol) server that wraps the La Growth Machine (LGM) sales automation API. It exposes 27 tools covering every endpoint in the LGM API v2.

## Architecture

- **Single-file server:** `src/index.ts` — all tools registered on one `McpServer` instance
- **Transport:** stdio (communicates with Claude Desktop / Claude Code via stdin/stdout)
- **Auth:** API key passed via `LGM_API_KEY` env var, appended to every request as `?apikey=`
- **Base URL:** `https://apiv2.lagrowthmachine.com/flow`

## Key Functions

- `lgmFetch(path, method, body?, queryParams?)` — central HTTP helper, handles auth, JSON parsing, and error handling
- `getApiKey()` — reads `LGM_API_KEY` from env, throws if missing

Both are exported for test access.

## Build & Test

```bash
npm run build         # tsc → dist/
npm run test          # unit tests (mocked fetch)
npm run test:e2e      # live API tests (needs LGM_API_KEY)
npm run test:all      # both
```

## Endpoint Map

| Method | Path | Tool Name |
|--------|------|-----------|
| GET | `/members` | `list_members` |
| GET | `/identities` | `list_identities` |
| GET | `/audiences` | `list_audiences` |
| POST | `/audiences` | `create_audience_from_linkedin` |
| GET | `/audiences/:id/detail` | `get_audience_detail` |
| GET | `/audiences/:id/leads` | `get_audience_leads` |
| POST | `/leads` | `create_or_update_lead` |
| GET | `/leads/search` | `search_lead` |
| POST | `/leads/status` | `update_lead_status` |
| POST | `/leads/removefromaudience` | `remove_lead_from_audiences` |
| GET | `/leads/:id/logs` | `get_lead_logs` |
| GET | `/leads/:id/conversations` | `get_lead_conversations` |
| GET | `/campaigns` | `get_campaigns` |
| GET | `/campaigns/:id` | `get_campaign` |
| GET | `/campaigns/:id/stats` | `get_campaign_stats` |
| GET | `/campaigns/:id/statsleads` | `get_campaign_leads_stats` |
| GET | `/campaigns/:id/messages` | `get_campaign_messages` |
| GET | `/inboxWebhooks` | `list_inbox_webhooks` |
| POST | `/inboxWebhooks` | `create_inbox_webhook` |
| DELETE | `/inboxWebhooks/:id` | `delete_inbox_webhook` |
| POST | `/inbox/linkedin` | `send_linkedin_message` |
| POST | `/inbox/email` | `send_email_message` |
| POST | `/inbox/conversations/note` | `edit_conversation_note` |
| POST | `/leads/visitors/rb2b/:audience` | `rb2b_native_webhook` |
| POST | `/leads/visitors/warmly/:audience` | `warmly_native_webhook` |
| POST | `/leads/visitors/vector/:audience` | `vector_native_webhook` |
| GET | `/conversations/:id/messages` | `get_conversation_messages` |

## Rate Limits

LGM enforces 50 calls per 10 seconds per API key. The server does not implement client-side rate limiting.

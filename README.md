# La Growth Machine MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that wraps the full [La Growth Machine API](https://documenter.getpostman.com/view/2071164/TVCmSkH2), giving Claude (and any MCP-compatible client) direct access to your LGM workspace.

## Features

27 tools covering every LGM API endpoint:

| Category | Tools |
|----------|-------|
| **Members** | `list_members` |
| **Identities** | `list_identities` |
| **Audiences** | `list_audiences`, `create_audience_from_linkedin`, `get_audience_detail`, `get_audience_leads` |
| **Leads** | `create_or_update_lead`, `search_lead`, `update_lead_status`, `remove_lead_from_audiences`, `get_lead_logs`, `get_lead_conversations` |
| **Campaigns** | `get_campaigns`, `get_campaign`, `get_campaign_stats`, `get_campaign_leads_stats`, `get_campaign_messages` |
| **Inbox Webhooks** | `list_inbox_webhooks`, `create_inbox_webhook`, `delete_inbox_webhook` |
| **Inbox Messaging** | `send_linkedin_message`, `send_email_message`, `edit_conversation_note` |
| **Website Visitors** | `rb2b_native_webhook`, `warmly_native_webhook`, `vector_native_webhook` |
| **Conversations** | `get_conversation_messages` |

## Prerequisites

- Node.js >= 18
- A La Growth Machine account with API access (Business plan, currently at 100 EUR/month)
- Your LGM API key from [Settings > API](https://app.lagrowthmachine.com/settings/api)

## Installation

```bash
git clone https://github.com/GigRadar/lgm-mcp-server.git
cd lgm-mcp-server
npm install
npm run build
```

## Claude Desktop Setup

Add the following to your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lgm": {
      "command": "node",
      "args": ["/absolute/path/to/lgm-mcp-server/dist/index.js"],
      "env": {
        "LGM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `/absolute/path/to/lgm-mcp-server` with the actual path where you cloned the repo, and `your-api-key-here` with your LGM API key.

Then **restart Claude Desktop** to pick up the new server.

## Claude Code Setup

```bash
claude mcp add lgm -- node /absolute/path/to/lgm-mcp-server/dist/index.js
```

Set the environment variable before launching:

```bash
export LGM_API_KEY=your-api-key-here
```

## Usage Examples

Once connected, you can ask Claude things like:

- "List all my LGM campaigns and their stats"
- "Search for a lead by email john@example.com"
- "Create a new lead in audience X with these details..."
- "Send a LinkedIn message to https://linkedin.com/in/someone saying..."
- "Show me the activity logs for lead ID abc123"
- "Set up a webhook to receive inbox events at https://my-server.com/webhook"

## Development

```bash
npm run build        # Compile TypeScript
npm run test         # Run unit tests
npm run test:e2e     # Run E2E tests (requires LGM_API_KEY)
npm run test:all     # Run all tests
```

## API Reference

Base URL: `https://apiv2.lagrowthmachine.com/flow`

All requests are authenticated via `apikey` query parameter. Rate limit: 50 calls per 10 seconds.

Full API docs: [Postman Documentation](https://documenter.getpostman.com/view/2071164/TVCmSkH2)

## Known Issues

- `POST /inbox/email` returns `400 {"error":"email or replyMessageId parameter needed"}` even with valid parameters per the docs. This appears to be an LGM API bug — reported to their support. LinkedIn messaging works fine.

## License

ISC

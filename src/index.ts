#!/usr/bin/env node

// Polyfill fetch for Node < 18
if (typeof globalThis.fetch === "undefined") {
  const mod = await import("node-fetch");
  // @ts-expect-error polyfill
  globalThis.fetch = mod.default;
  // @ts-expect-error polyfill
  globalThis.Response = mod.Response;
  // @ts-expect-error polyfill
  globalThis.Request = mod.Request;
  // @ts-expect-error polyfill
  globalThis.Headers = mod.Headers;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://apiv2.lagrowthmachine.com/flow";

export function getApiKey(): string {
  const key = process.env.LGM_API_KEY;
  if (!key) {
    throw new Error("LGM_API_KEY environment variable is required");
  }
  return key;
}

export async function lgmFetch(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  queryParams?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("apikey", getApiKey());
  if (queryParams) {
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== "") {
        url.searchParams.set(k, v);
      }
    }
  }

  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), options);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`LGM API error ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// --- Server setup ---

const server = new McpServer({
  name: "lgm-mcp-server",
  version: "1.0.0",
});

// ==================== MEMBERS ====================

server.tool(
  "list_members",
  "List all members (users) associated with your LGM workspace",
  {},
  async () => jsonResult(await lgmFetch("/members"))
);

// ==================== IDENTITIES ====================

server.tool(
  "list_identities",
  "List all connected identities in your LGM account. An identity is the profile (LinkedIn, email, etc.) used to send messages.",
  {},
  async () => jsonResult(await lgmFetch("/identities"))
);

// ==================== AUDIENCES ====================

server.tool(
  "list_audiences",
  "List all audiences in your LGM account. Audiences are groups of leads targeted in campaigns.",
  {},
  async () => jsonResult(await lgmFetch("/audiences"))
);

server.tool(
  "create_audience_from_linkedin",
  "Import leads into an audience from a LinkedIn URL (regular search, Sales Navigator, or post URL)",
  {
    audience: z.string().describe("Audience name to import leads into"),
    identityId: z.string().describe("Identity ID to use for the LinkedIn import"),
    linkedinUrl: z.string().describe("LinkedIn search URL, Sales Navigator URL, or post URL"),
    linkedinPostCategory: z.string().optional().describe("Category filter for LinkedIn post (e.g. 'likes', 'comments')"),
    excludeContactedLeads: z.boolean().optional().describe("Exclude leads already contacted"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/audiences", "POST", params as Record<string, unknown>));
  }
);

server.tool(
  "get_audience_detail",
  "Get detailed information about a specific audience",
  {
    audienceId: z.string().describe("The audience ID"),
  },
  async ({ audienceId }) => {
    return jsonResult(await lgmFetch(`/audiences/${audienceId}/detail`));
  }
);

server.tool(
  "get_audience_leads",
  "List leads in a specific audience with pagination",
  {
    audienceId: z.string().describe("The audience ID"),
    skip: z.number().optional().default(0).describe("Number of leads to skip"),
    limit: z.number().optional().default(25).describe("Max leads to return"),
  },
  async ({ audienceId, skip, limit }) => {
    const query: Record<string, string> = {};
    if (skip !== undefined) query.skip = String(skip);
    if (limit !== undefined) query.limit = String(limit);
    return jsonResult(await lgmFetch(`/audiences/${audienceId}/leads`, "GET", undefined, query));
  }
);

// ==================== LEADS ====================

server.tool(
  "create_or_update_lead",
  "Create a new lead or update an existing lead in a specified audience",
  {
    audience: z.string().describe("Audience ID to add the lead to"),
    firstname: z.string().optional().describe("Lead's first name"),
    lastname: z.string().optional().describe("Lead's last name"),
    proEmail: z.string().optional().describe("Professional email address"),
    persoEmail: z.string().optional().describe("Personal email address"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
    twitter: z.string().optional().describe("Twitter/X handle"),
    companyName: z.string().optional().describe("Company name"),
    companyUrl: z.string().optional().describe("Company website URL"),
    phone: z.string().optional().describe("Phone number"),
    jobTitle: z.string().optional().describe("Job title"),
    customFields: z
      .record(z.string(), z.string())
      .optional()
      .describe("Custom fields as key-value pairs (custom variables / snippets)"),
  },
  async (params) => {
    const { customFields, ...rest } = params;
    const body: Record<string, unknown> = { ...rest };
    if (customFields) {
      body.customFields = customFields;
    }
    return jsonResult(await lgmFetch("/leads", "POST", body));
  }
);

server.tool(
  "search_lead",
  "Search for a lead by email, LinkedIn URL, lead ID, name, or company",
  {
    email: z.string().optional().describe("Email address to search"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL to search"),
    leadId: z.string().optional().describe("LGM lead ID"),
    firstname: z.string().optional().describe("First name"),
    lastname: z.string().optional().describe("Last name"),
    companyName: z.string().optional().describe("Company name"),
    companyUrl: z.string().optional().describe("Company URL / domain"),
  },
  async (params) => {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v) query[k] = v;
    }
    return jsonResult(await lgmFetch("/leads/search", "GET", undefined, query));
  }
);

server.tool(
  "update_lead_status",
  "Update the status of a lead within specific campaigns. Identify the lead by at least one identifier.",
  {
    status: z.string().describe("New status for the lead (e.g. CONVERTED, NOTINTERESTED)"),
    campaign: z.union([z.string(), z.array(z.string())]).describe("Campaign ID, array of IDs, campaign name, or 'all'"),
    crm_id: z.string().optional().describe("CRM ID of the lead"),
    firstname: z.string().optional().describe("First name"),
    lastname: z.string().optional().describe("Last name"),
    persoEmail: z.string().optional().describe("Personal email"),
    proEmail: z.string().optional().describe("Professional email"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
    twitter: z.string().optional().describe("Twitter/X handle"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/leads/status", "POST", params as Record<string, unknown>));
  }
);

server.tool(
  "remove_lead_from_audiences",
  "Remove a lead from one or more audiences. Identify the lead by at least one identifier.",
  {
    audience: z.union([z.string(), z.array(z.string())]).describe("Audience ID, array of IDs, or 'all'"),
    crm_id: z.string().optional().describe("CRM ID of the lead"),
    firstname: z.string().optional().describe("First name"),
    lastname: z.string().optional().describe("Last name"),
    persoEmail: z.string().optional().describe("Personal email"),
    proEmail: z.string().optional().describe("Professional email"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL"),
    twitter: z.string().optional().describe("Twitter/X handle"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/leads/removefromaudience", "POST", params as Record<string, unknown>));
  }
);

server.tool(
  "get_lead_logs",
  "Get activity logs for a specific lead (messages sent, enrichments, status changes, etc.)",
  {
    leadId: z.string().describe("The lead ID"),
  },
  async ({ leadId }) => {
    return jsonResult(await lgmFetch(`/leads/${leadId}/logs`));
  }
);

server.tool(
  "get_lead_conversations",
  "Get all conversations for a specific lead across channels",
  {
    leadId: z.string().describe("The lead ID"),
  },
  async ({ leadId }) => {
    return jsonResult(await lgmFetch(`/leads/${leadId}/conversations`));
  }
);

// ==================== CAMPAIGNS ====================

server.tool(
  "get_campaigns",
  "Retrieve all campaigns with pagination support (max 25 per page)",
  {
    skip: z.number().optional().default(0).describe("Number of campaigns to skip (for pagination)"),
    limit: z.number().optional().default(25).describe("Max campaigns to return (max 25)"),
  },
  async ({ skip, limit }) => {
    const query: Record<string, string> = {};
    if (skip !== undefined) query.skip = String(skip);
    if (limit !== undefined) query.limit = String(Math.min(limit, 25));
    return jsonResult(await lgmFetch("/campaigns", "GET", undefined, query));
  }
);

server.tool(
  "get_campaign",
  "Get a single campaign by ID with full details",
  {
    campaignId: z.string().describe("The campaign ID"),
  },
  async ({ campaignId }) => {
    return jsonResult(await lgmFetch(`/campaigns/${campaignId}`));
  }
);

server.tool(
  "get_campaign_stats",
  "Get engagement statistics for a campaign (replies, conversions, channel breakdowns)",
  {
    campaignId: z.string().describe("The campaign ID"),
  },
  async ({ campaignId }) => {
    return jsonResult(await lgmFetch(`/campaigns/${campaignId}/stats`));
  }
);

server.tool(
  "get_campaign_leads_stats",
  "Get per-lead statistics for a campaign. Supports cursor-based pagination (getLeadsAfter/getLeadsBefore) for simple page-by-page access, OR offset-based pagination (skip/limit) and status filtering — when skip>0 or status is provided, all pages are fetched client-side and then filtered/sliced.",
  {
    campaignId: z.string().describe("The campaign ID"),
    getLeadsAfter: z.string().optional().describe("Lead ID to get results after (cursor-based forward pagination, single page)"),
    getLeadsBefore: z.string().optional().describe("Lead ID to get results before (cursor-based backward pagination, single page)"),
    status: z.string().optional().describe("Filter leads by status, e.g. 'replied', 'converted', 'notinterested'. Triggers full fetch of all pages."),
    skip: z.number().optional().default(0).describe("Number of leads to skip for offset-based pagination. Triggers full fetch of all pages."),
    limit: z.number().optional().default(25).describe("Max leads to return (default 25)"),
  },
  async ({ campaignId, getLeadsAfter, getLeadsBefore, status, skip, limit }) => {
    const needsClientSide = !!status || (!!skip && skip > 0);

    if (!needsClientSide) {
      // Direct single-page cursor call — original behaviour
      const query: Record<string, string> = {};
      if (getLeadsAfter) query.getLeadsAfter = getLeadsAfter;
      if (getLeadsBefore) query.getLeadsBefore = getLeadsBefore;
      return jsonResult(await lgmFetch(`/campaigns/${campaignId}/statsleads`, "GET", undefined, query));
    }

    // Fetch all pages using cursor pagination, then filter/slice client-side
    const allLeads: unknown[] = [];
    let cursor: string | undefined = undefined;
    const MAX_PAGES = 40; // safety cap: 40 × 25 = 1 000 leads

    for (let page = 0; page < MAX_PAGES; page++) {
      const query: Record<string, string> = {};
      if (cursor) query.getLeadsAfter = cursor;

      const response = await lgmFetch(`/campaigns/${campaignId}/statsleads`, "GET", undefined, query) as Record<string, unknown>;

      // Handle common LGM response shapes
      const leads = (
        Array.isArray(response.leads) ? response.leads :
        Array.isArray(response.data) ? response.data :
        Array.isArray(response.statsLeads) ? response.statsLeads :
        []
      ) as Record<string, unknown>[];

      allLeads.push(...leads);

      if (leads.length < 25) break; // reached last page

      const lastLead = leads[leads.length - 1] as Record<string, unknown> | undefined;
      cursor = lastLead ? String(lastLead.id ?? lastLead._id ?? "") : "";
      if (!cursor) break;
    }

    // Apply status filter (case-insensitive)
    const filtered = status
      ? allLeads.filter((l) => {
          const lead = l as Record<string, unknown>;
          const s = ((lead.status ?? lead.leadStatus ?? "") as string).toLowerCase();
          return s === status.toLowerCase();
        })
      : allLeads;

    // Apply offset pagination
    const actualSkip = skip ?? 0;
    const actualLimit = limit ?? 25;
    const paginated = filtered.slice(actualSkip, actualSkip + actualLimit);

    return jsonResult({
      leads: paginated,
      total: filtered.length,
      skip: actualSkip,
      limit: actualLimit,
      hasMore: actualSkip + actualLimit < filtered.length,
    });
  }
);

server.tool(
  "get_campaign_messages",
  "Get messages sent in a campaign",
  {
    campaignId: z.string().describe("The campaign ID"),
  },
  async ({ campaignId }) => {
    return jsonResult(await lgmFetch(`/campaigns/${campaignId}/messages`));
  }
);

// ==================== INBOX WEBHOOKS ====================

server.tool(
  "list_inbox_webhooks",
  "List all inbox webhooks configured in your workspace",
  {},
  async () => jsonResult(await lgmFetch("/inboxWebhooks"))
);

server.tool(
  "create_inbox_webhook",
  "Create an inbox webhook for real-time notifications on inbox events (LinkedIn and Email messages)",
  {
    url: z.string().describe("Webhook destination URL (must be publicly accessible)"),
    name: z.string().describe("Name for this webhook"),
    campaigns: z
      .array(z.string())
      .optional()
      .default(["all"])
      .describe("Array of campaign IDs to filter events for, or ['all'] for all campaigns"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/inboxWebhooks", "POST", params as Record<string, unknown>));
  }
);

server.tool(
  "delete_inbox_webhook",
  "Delete an inbox webhook by its ID",
  {
    webhookId: z.string().describe("The webhook ID to delete"),
  },
  async ({ webhookId }) => {
    return jsonResult(await lgmFetch(`/inboxWebhooks/${webhookId}`, "DELETE"));
  }
);

// ==================== INBOX MESSAGING ====================

server.tool(
  "send_linkedin_message",
  "Send a LinkedIn text or voice message to a lead. Requires either leadId or linkedinUrl, and either message or audioUrl.",
  {
    identityId: z.string().describe("ID of the LinkedIn identity that will send the message"),
    memberId: z.string().describe("ID of the member (user) performing the action"),
    leadId: z.string().optional().describe("The lead ID to message"),
    linkedinUrl: z.string().optional().describe("LinkedIn profile URL (if leadId not provided)"),
    message: z.string().optional().describe("Text message to send (required if audioUrl not provided)"),
    audioUrl: z.string().optional().describe("URL to a voice message audio file"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/inbox/linkedin", "POST", params as Record<string, unknown>));
  }
);

server.tool(
  "send_email_message",
  "Reply to an existing email thread with a lead. Cannot initiate new email conversations — use replyToMessageId (get it from get_conversation_messages) or replyInLastThread. Requires either leadId or leadEmail (not both).",
  {
    message: z.object({
      html: z.string().describe("HTML version of the email body"),
      text: z.string().describe("Plain-text version of the email body"),
    }).describe("Email message content"),
    identityId: z.string().describe("ID of the email identity that will send the message"),
    leadId: z.string().optional().describe("ID of the target lead"),
    leadEmail: z.string().optional().describe("Email address of the lead"),
    replyInLastThread: z.boolean().optional().describe("Reply in the most recent email thread with this lead"),
    replyToMessageId: z.string().optional().describe("Specific message ID to reply to"),
    subject: z.string().optional().describe("Email subject line (for new threads)"),
    cc: z.array(z.string()).optional().describe("CC email addresses"),
    bcc: z.array(z.string()).optional().describe("BCC email addresses"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/inbox/email", "POST", params as Record<string, unknown>));
  }
);

server.tool(
  "edit_conversation_note",
  "Add or replace a note on an inbox conversation. Identify the conversation by conversationId, or by lead identifiers.",
  {
    conversationId: z.string().optional().describe("The conversation ID"),
    leadId: z.string().optional().describe("The lead ID"),
    email: z.string().optional().describe("Lead email to identify the conversation"),
    linkedinUrl: z.string().optional().describe("Lead LinkedIn URL to identify the conversation"),
    note: z.string().describe("Note content to add or replace"),
    mode: z.enum(["append", "replace"]).describe("'append' to add to existing note, 'replace' to overwrite"),
    identityId: z.string().optional().describe("Identity ID for context"),
    campaignId: z.string().optional().describe("Campaign ID for context"),
    campaignName: z.string().optional().describe("Campaign name for context"),
  },
  async (params) => {
    return jsonResult(await lgmFetch("/inbox/conversations/note", "POST", params as Record<string, unknown>));
  }
);

// ==================== WEBSITE VISITORS ====================

server.tool(
  "rb2b_native_webhook",
  "Webhook endpoint for RB2B website visitor tracking. Each visitor is pushed into the specified audience.",
  {
    audienceName: z.string().default("RB2B_Website_Visitors").describe("Audience name to push visitors into"),
  },
  async ({ audienceName }) => {
    return jsonResult(await lgmFetch(`/leads/visitors/rb2b/${encodeURIComponent(audienceName)}`, "POST", {}));
  }
);

server.tool(
  "warmly_native_webhook",
  "Webhook endpoint for Warmly website visitor tracking. Each visitor is pushed into the specified audience.",
  {
    audienceName: z.string().default("Warmly_Website_Visitors").describe("Audience name to push visitors into"),
  },
  async ({ audienceName }) => {
    return jsonResult(await lgmFetch(`/leads/visitors/warmly/${encodeURIComponent(audienceName)}`, "POST", {}));
  }
);

server.tool(
  "vector_native_webhook",
  "Webhook endpoint for Vector website visitor tracking. Each visitor is pushed into the specified audience.",
  {
    audienceName: z.string().default("Vector_Website_Visitors").describe("Audience name to push visitors into"),
  },
  async ({ audienceName }) => {
    return jsonResult(await lgmFetch(`/leads/visitors/vector/${encodeURIComponent(audienceName)}`, "POST", {}));
  }
);

// ==================== CONVERSATIONS ====================

server.tool(
  "get_conversation_messages",
  "Get messages from a specific conversation with pagination",
  {
    conversationId: z.string().describe("The conversation ID (24-char hex ObjectId)"),
    page: z.number().optional().default(0).describe("Page number for pagination (starts at 0)"),
  },
  async ({ conversationId, page }) => {
    const query: Record<string, string> = {};
    if (page !== undefined) query.page = String(page);
    return jsonResult(await lgmFetch(`/conversations/${conversationId}/messages`, "GET", undefined, query));
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LGM MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

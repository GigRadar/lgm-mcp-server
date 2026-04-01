import { describe, it, expect } from "vitest";
import { lgmFetch } from "./index.js";

/**
 * E2E tests against the live La Growth Machine API.
 * Requires LGM_API_KEY environment variable.
 *
 * Run: LGM_API_KEY=... npm run test:e2e
 */

const API_KEY = process.env.LGM_API_KEY;

describe.skipIf(!API_KEY)("LGM API E2E Tests", () => {
  let memberId: string;
  let identityId: string;
  let audienceId: string;
  let campaignId: string;
  let testLeadId: string;
  let webhookId: string;

  // ==================== MEMBERS ====================

  it("GET /members — lists workspace members", async () => {
    const data = (await lgmFetch("/members")) as any;
    expect(data.statusCode).toBe(200);
    expect(Array.isArray(data.members)).toBe(true);
    expect(data.members.length).toBeGreaterThan(0);
    expect(data.members[0]).toHaveProperty("id");
    expect(data.members[0]).toHaveProperty("name");
    memberId = data.members[0].id;
  });

  // ==================== IDENTITIES ====================

  it("GET /identities — lists connected identities", async () => {
    const data = (await lgmFetch("/identities")) as any;
    expect(data.statusCode).toBe(200);
    expect(Array.isArray(data.identities)).toBe(true);
    expect(data.identities.length).toBeGreaterThan(0);
    expect(data.identities[0]).toHaveProperty("id");
    identityId = data.identities[0].id;
  });

  // ==================== AUDIENCES ====================

  it("GET /audiences — lists all audiences", async () => {
    const data = (await lgmFetch("/audiences")) as any;
    expect(data.statusCode).toBe(200);
    expect(Array.isArray(data.audiences)).toBe(true);
    expect(data.audiences.length).toBeGreaterThan(0);
    audienceId = data.audiences[0].id;
    expect(data.audiences[0]).toHaveProperty("name");
  });

  it("GET /audiences/:id/detail — gets audience details", async () => {
    const data = (await lgmFetch(`/audiences/${audienceId}/detail`)) as any;
    expect(data.statusCode).toBe(200);
    expect(data).toHaveProperty("data");
  });

  it("GET /audiences/:id/leads — lists leads in audience", async () => {
    const data = (await lgmFetch(`/audiences/${audienceId}/leads`, "GET", undefined, {
      skip: "0",
      limit: "2",
    })) as any;
    expect(data.statusCode).toBe(200);
    expect(data).toHaveProperty("data");
    expect(Array.isArray(data.data)).toBe(true);
  });

  // ==================== LEADS ====================

  it("POST /leads — creates a lead", async () => {
    const data = (await lgmFetch("/leads", "POST", {
      audience: audienceId,
      firstname: "E2ETest",
      lastname: "Lead",
      proEmail: `e2e-test-${Date.now()}@example.com`,
    })) as any;
    expect(data.statusCode).toBe(200);
    expect(data).toHaveProperty("leadId");
    testLeadId = data.leadId;
  });

  it("GET /leads/search — finds lead by ID", async () => {
    const data = (await lgmFetch("/leads/search", "GET", undefined, {
      leadId: testLeadId,
    })) as any;
    expect(data.statusCode).toBe(200);
    expect(data.lead).toBeDefined();
    expect(data.lead.id).toBe(testLeadId);
  });

  it("GET /leads/search — returns error for non-existent lead", async () => {
    await expect(
      lgmFetch("/leads/search", "GET", undefined, {
        email: "definitely-does-not-exist-9999@nowhere.test",
      })
    ).rejects.toThrow(/LGM API error/);
  });

  it("GET /leads/:id/logs — gets lead activity logs", async () => {
    const data = (await lgmFetch(`/leads/${testLeadId}/logs`)) as any;
    expect(data.statusCode).toBe(200);
    expect(data).toHaveProperty("data");
  });

  it("GET /leads/:id/conversations — gets lead conversations", async () => {
    const data = (await lgmFetch(`/leads/${testLeadId}/conversations`)) as any;
    expect(data.statusCode).toBe(200);
    expect(data).toHaveProperty("data");
  });

  // ==================== CAMPAIGNS ====================

  it("GET /campaigns — lists campaigns with pagination", async () => {
    const data = (await lgmFetch("/campaigns", "GET", undefined, {
      skip: "0",
      limit: "5",
    })) as any;
    expect(data.statusCode).toBe(200);
    expect(Array.isArray(data.campaigns)).toBe(true);
    if (data.campaigns.length > 0) {
      campaignId = data.campaigns[0].id;
      expect(data.campaigns[0]).toHaveProperty("name");
      expect(data.campaigns[0]).toHaveProperty("status");
    }
  });

  it("GET /campaigns/:id — gets single campaign", async () => {
    if (!campaignId) return;
    const data = (await lgmFetch(`/campaigns/${campaignId}`)) as any;
    expect(data.statusCode).toBe(200);
    expect(data.campaign).toBeDefined();
    expect(data.campaign.id).toBe(campaignId);
  });

  it("GET /campaigns/:id/stats — gets campaign statistics", async () => {
    if (!campaignId) return;
    const data = (await lgmFetch(`/campaigns/${campaignId}/stats`)) as any;
    expect(data.statusCode).toBe(200);
    expect(data).toHaveProperty("engagementStats");
  });

  it("GET /campaigns/:id/statsleads — gets per-lead stats", async () => {
    if (!campaignId) return;
    const data = (await lgmFetch(`/campaigns/${campaignId}/statsleads`)) as any;
    expect(data.statusCode).toBe(200);
  });

  it("GET /campaigns/:id/messages — gets campaign messages", async () => {
    if (!campaignId) return;
    const data = (await lgmFetch(`/campaigns/${campaignId}/messages`)) as any;
    expect(data.statusCode).toBe(200);
  });

  // ==================== LEAD STATUS ====================

  it("POST /leads/status — attempts to update lead status", async () => {
    if (!campaignId || !testLeadId) return;
    try {
      const data = (await lgmFetch("/leads/status", "POST", {
        status: "CONVERTED",
        campaign: campaignId,
        proEmail: `e2e-test-${Date.now()}@example.com`,
      })) as any;
      expect(data.statusCode).toBe(200);
    } catch (e: any) {
      expect(e.message).toMatch(/LGM API error/);
    }
  });

  // ==================== REMOVE LEAD FROM AUDIENCE ====================

  it("POST /leads/removefromaudience — attempts to remove lead", async () => {
    try {
      const data = (await lgmFetch("/leads/removefromaudience", "POST", {
        audience: audienceId,
        proEmail: `e2e-cleanup-${Date.now()}@example.com`,
      })) as any;
      expect(data.statusCode).toBe(200);
    } catch (e: any) {
      expect(e.message).toMatch(/LGM API error/);
    }
  });

  // ==================== INBOX WEBHOOKS ====================

  it("GET /inboxWebhooks — lists webhooks", async () => {
    const data = (await lgmFetch("/inboxWebhooks")) as any;
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST /inboxWebhooks — creates a webhook", async () => {
    const data = (await lgmFetch("/inboxWebhooks", "POST", {
      url: "https://example.com/e2e-test-webhook",
      name: "e2e-test-webhook",
      campaigns: ["all"],
    })) as any;
    expect(data).toHaveProperty("id");
    webhookId = data.id;
  });

  it("DELETE /inboxWebhooks/:id — deletes the test webhook", async () => {
    const data = (await lgmFetch(`/inboxWebhooks/${webhookId}`, "DELETE")) as any;
    expect(data.success).toBe(true);
  });

  it("verifies webhook was deleted", async () => {
    const data = (await lgmFetch("/inboxWebhooks")) as any;
    const found = data.find((w: any) => w.id === webhookId);
    expect(found).toBeUndefined();
  });

  // ==================== INBOX MESSAGING (skip by default — sends real messages) ====================

  it.skip("POST /inbox/linkedin — sends LinkedIn message", async () => {
    const data = (await lgmFetch("/inbox/linkedin", "POST", {
      identityId,
      memberId,
      leadId: testLeadId,
      message: "E2E test message - please ignore",
    })) as any;
    expect(data.statusCode).toBe(200);
  });

  it.skip("POST /inbox/email — sends email message", async () => {
    const data = (await lgmFetch("/inbox/email", "POST", {
      message: { html: "<p>E2E test</p>", text: "E2E test" },
      identityId,
      leadId: testLeadId,
      subject: "E2E Test - please ignore",
    })) as any;
    expect(data.statusCode).toBe(200);
  });

  it.skip("POST /inbox/conversations/note — edits conversation note", async () => {
    const data = (await lgmFetch("/inbox/conversations/note", "POST", {
      leadId: testLeadId,
      note: "E2E test note",
      mode: "append",
    })) as any;
    expect(data.success).toBe(true);
  });

  // ==================== WEBSITE VISITORS (endpoint availability) ====================

  it("POST /leads/visitors/vector/:audience — endpoint responds", async () => {
    try {
      await lgmFetch("/leads/visitors/vector/E2E_Test_Visitors", "POST", {});
    } catch (e: any) {
      // Endpoint exists but payload is empty — error expected
      expect(e.message).toMatch(/LGM API error/);
    }
  });

  it("POST /leads/visitors/rb2b/:audience — endpoint responds", async () => {
    try {
      await lgmFetch("/leads/visitors/rb2b/E2E_Test_Visitors", "POST", {});
    } catch (e: any) {
      expect(e.message).toMatch(/LGM API error/);
    }
  });

  it("POST /leads/visitors/warmly/:audience — endpoint responds", async () => {
    try {
      await lgmFetch("/leads/visitors/warmly/E2E_Test_Visitors", "POST", {});
    } catch (e: any) {
      expect(e.message).toMatch(/LGM API error/);
    }
  });
});

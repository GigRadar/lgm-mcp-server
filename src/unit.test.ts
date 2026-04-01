import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getApiKey, lgmFetch } from "./index.js";

describe("getApiKey", () => {
  const originalEnv = process.env.LGM_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.LGM_API_KEY = originalEnv;
    } else {
      delete process.env.LGM_API_KEY;
    }
  });

  it("returns the API key from env", () => {
    process.env.LGM_API_KEY = "test-key-123";
    expect(getApiKey()).toBe("test-key-123");
  });

  it("throws when LGM_API_KEY is not set", () => {
    delete process.env.LGM_API_KEY;
    expect(() => getApiKey()).toThrow("LGM_API_KEY environment variable is required");
  });
});

describe("lgmFetch", () => {
  const originalEnv = process.env.LGM_API_KEY;

  beforeEach(() => {
    process.env.LGM_API_KEY = "mock-api-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv !== undefined) {
      process.env.LGM_API_KEY = originalEnv;
    } else {
      delete process.env.LGM_API_KEY;
    }
  });

  function mockOk(body: unknown) {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 200 })
    );
  }

  function lastUrl(): URL {
    return new URL(vi.mocked(fetch).mock.calls[0]![0] as string);
  }

  function lastOpts(): RequestInit {
    return vi.mocked(fetch).mock.calls[0]![1]!;
  }

  // ==================== Core lgmFetch behavior ====================

  it("makes GET requests with apikey query param", async () => {
    mockOk({ statusCode: 200, members: [] });
    const result = await lgmFetch("/members");
    expect(result).toEqual({ statusCode: 200, members: [] });
    expect(lastUrl().pathname).toBe("/flow/members");
    expect(lastUrl().searchParams.get("apikey")).toBe("mock-api-key");
    expect(lastOpts().method).toBe("GET");
  });

  it("makes POST requests with body", async () => {
    mockOk({ statusCode: 200, leadId: "abc123" });
    const body = { audience: "aud1", firstname: "Test" };
    await lgmFetch("/leads", "POST", body);
    expect(lastOpts().method).toBe("POST");
    expect(lastOpts().body).toBe(JSON.stringify(body));
  });

  it("makes DELETE requests", async () => {
    mockOk({ success: true });
    await lgmFetch("/inboxWebhooks/wh123", "DELETE");
    expect(lastUrl().pathname).toBe("/flow/inboxWebhooks/wh123");
    expect(lastOpts().method).toBe("DELETE");
  });

  it("appends additional query parameters", async () => {
    mockOk({ statusCode: 200 });
    await lgmFetch("/leads/search", "GET", undefined, {
      email: "test@example.com",
      leadId: "lead123",
    });
    expect(lastUrl().searchParams.get("email")).toBe("test@example.com");
    expect(lastUrl().searchParams.get("leadId")).toBe("lead123");
  });

  it("skips empty query parameters", async () => {
    mockOk({ statusCode: 200 });
    await lgmFetch("/leads/search", "GET", undefined, {
      email: "test@example.com",
      leadId: "",
    });
    expect(lastUrl().searchParams.has("email")).toBe(true);
    expect(lastUrl().searchParams.has("leadId")).toBe(false);
  });

  it("throws on non-OK responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response('{"error":"Not Found"}', { status: 404 })
    );
    await expect(lgmFetch("/nonexistent")).rejects.toThrow(
      'LGM API error 404: {"error":"Not Found"}'
    );
  });

  it("handles non-JSON response text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("OK", { status: 200 })
    );
    const result = await lgmFetch("/some-path");
    expect(result).toBe("OK");
  });

  it("does not include body on GET requests even if body provided", async () => {
    mockOk({ statusCode: 200 });
    await lgmFetch("/test", "GET", { some: "data" });
    expect(lastOpts().body).toBeUndefined();
  });

  // ==================== All 27 endpoint paths ====================

  describe("endpoint URL construction", () => {
    // --- Campaigns (5) ---
    it("GET /campaigns", async () => {
      mockOk({ campaigns: [] });
      await lgmFetch("/campaigns", "GET", undefined, { skip: "0", limit: "25" });
      expect(lastUrl().pathname).toBe("/flow/campaigns");
      expect(lastUrl().searchParams.get("skip")).toBe("0");
      expect(lastUrl().searchParams.get("limit")).toBe("25");
    });

    it("GET /campaigns/:id", async () => {
      mockOk({});
      await lgmFetch("/campaigns/camp123");
      expect(lastUrl().pathname).toBe("/flow/campaigns/camp123");
    });

    it("GET /campaigns/:id/stats", async () => {
      mockOk({});
      await lgmFetch("/campaigns/camp123/stats");
      expect(lastUrl().pathname).toBe("/flow/campaigns/camp123/stats");
    });

    it("GET /campaigns/:id/statsleads with cursor pagination", async () => {
      mockOk({});
      await lgmFetch("/campaigns/camp123/statsleads", "GET", undefined, { getLeadsAfter: "lead1" });
      expect(lastUrl().pathname).toBe("/flow/campaigns/camp123/statsleads");
      expect(lastUrl().searchParams.get("getLeadsAfter")).toBe("lead1");
    });

    it("GET /campaigns/:id/messages", async () => {
      mockOk({});
      await lgmFetch("/campaigns/camp123/messages");
      expect(lastUrl().pathname).toBe("/flow/campaigns/camp123/messages");
    });

    // --- Audiences (4) ---
    it("GET /audiences", async () => {
      mockOk([]);
      await lgmFetch("/audiences");
      expect(lastUrl().pathname).toBe("/flow/audiences");
    });

    it("POST /audiences (linkedin import)", async () => {
      mockOk({});
      await lgmFetch("/audiences", "POST", { audience: "test", identityId: "id1", linkedinUrl: "https://linkedin.com/search" });
      expect(lastUrl().pathname).toBe("/flow/audiences");
      expect(lastOpts().method).toBe("POST");
      expect(JSON.parse(lastOpts().body as string)).toHaveProperty("linkedinUrl");
    });

    it("GET /audiences/:id/detail", async () => {
      mockOk({});
      await lgmFetch("/audiences/aud123/detail");
      expect(lastUrl().pathname).toBe("/flow/audiences/aud123/detail");
    });

    it("GET /audiences/:id/leads", async () => {
      mockOk({});
      await lgmFetch("/audiences/aud123/leads", "GET", undefined, { skip: "0", limit: "10" });
      expect(lastUrl().pathname).toBe("/flow/audiences/aud123/leads");
      expect(lastUrl().searchParams.get("limit")).toBe("10");
    });

    // --- Identities (1) ---
    it("GET /identities", async () => {
      mockOk([]);
      await lgmFetch("/identities");
      expect(lastUrl().pathname).toBe("/flow/identities");
    });

    // --- Leads (6) ---
    it("POST /leads (create/update)", async () => {
      mockOk({ leadId: "new1" });
      await lgmFetch("/leads", "POST", { audience: "aud1", firstname: "Jane" });
      expect(lastUrl().pathname).toBe("/flow/leads");
      expect(lastOpts().method).toBe("POST");
    });

    it("GET /leads/search with params", async () => {
      mockOk({});
      await lgmFetch("/leads/search", "GET", undefined, { email: "a@b.com" });
      expect(lastUrl().pathname).toBe("/flow/leads/search");
      expect(lastUrl().searchParams.get("email")).toBe("a@b.com");
    });

    it("POST /leads/status", async () => {
      mockOk({});
      await lgmFetch("/leads/status", "POST", { status: "CONVERTED", campaign: "all", proEmail: "a@b.com" });
      expect(lastUrl().pathname).toBe("/flow/leads/status");
      expect(JSON.parse(lastOpts().body as string).status).toBe("CONVERTED");
    });

    it("POST /leads/removefromaudience", async () => {
      mockOk({});
      await lgmFetch("/leads/removefromaudience", "POST", { audience: "all", proEmail: "a@b.com" });
      expect(lastUrl().pathname).toBe("/flow/leads/removefromaudience");
    });

    it("GET /leads/:id/logs", async () => {
      mockOk({});
      await lgmFetch("/leads/lead123/logs");
      expect(lastUrl().pathname).toBe("/flow/leads/lead123/logs");
    });

    it("GET /leads/:id/conversations", async () => {
      mockOk({});
      await lgmFetch("/leads/lead123/conversations");
      expect(lastUrl().pathname).toBe("/flow/leads/lead123/conversations");
    });

    // --- Members (1) ---
    it("GET /members", async () => {
      mockOk([]);
      await lgmFetch("/members");
      expect(lastUrl().pathname).toBe("/flow/members");
    });

    // --- Inbox Webhooks (3) ---
    it("POST /inboxWebhooks", async () => {
      mockOk({ id: "wh1" });
      await lgmFetch("/inboxWebhooks", "POST", { url: "https://hook.test", name: "test", campaigns: ["all"] });
      expect(lastUrl().pathname).toBe("/flow/inboxWebhooks");
      expect(lastOpts().method).toBe("POST");
    });

    it("DELETE /inboxWebhooks/:id", async () => {
      mockOk({ success: true });
      await lgmFetch("/inboxWebhooks/wh123", "DELETE");
      expect(lastUrl().pathname).toBe("/flow/inboxWebhooks/wh123");
      expect(lastOpts().method).toBe("DELETE");
    });

    it("GET /inboxWebhooks", async () => {
      mockOk([]);
      await lgmFetch("/inboxWebhooks");
      expect(lastUrl().pathname).toBe("/flow/inboxWebhooks");
    });

    // --- Inbox Messaging (3) ---
    it("POST /inbox/linkedin", async () => {
      mockOk({ statusCode: 200 });
      await lgmFetch("/inbox/linkedin", "POST", {
        identityId: "id1", memberId: "m1", leadId: "l1", message: "hi",
      });
      expect(lastUrl().pathname).toBe("/flow/inbox/linkedin");
      expect(lastOpts().method).toBe("POST");
    });

    it("POST /inbox/email", async () => {
      mockOk({ statusCode: 200 });
      await lgmFetch("/inbox/email", "POST", {
        message: { html: "<p>hi</p>", text: "hi" },
        identityId: "id1", leadId: "l1", subject: "Hello",
      });
      expect(lastUrl().pathname).toBe("/flow/inbox/email");
    });

    it("POST /inbox/conversations/note", async () => {
      mockOk({ success: true });
      await lgmFetch("/inbox/conversations/note", "POST", {
        conversationId: "conv1", note: "test note", mode: "append",
      });
      expect(lastUrl().pathname).toBe("/flow/inbox/conversations/note");
    });

    // --- Website Visitors (3) ---
    it("POST /leads/visitors/rb2b/:audience", async () => {
      mockOk({});
      await lgmFetch("/leads/visitors/rb2b/RB2B_Website_Visitors", "POST", {});
      expect(lastUrl().pathname).toBe("/flow/leads/visitors/rb2b/RB2B_Website_Visitors");
    });

    it("POST /leads/visitors/warmly/:audience", async () => {
      mockOk({});
      await lgmFetch("/leads/visitors/warmly/Warmly_Website_Visitors", "POST", {});
      expect(lastUrl().pathname).toBe("/flow/leads/visitors/warmly/Warmly_Website_Visitors");
    });

    it("POST /leads/visitors/vector/:audience", async () => {
      mockOk({});
      await lgmFetch("/leads/visitors/vector/Vector_Website_Visitors", "POST", {});
      expect(lastUrl().pathname).toBe("/flow/leads/visitors/vector/Vector_Website_Visitors");
    });

    // --- Conversations (1) ---
    it("GET /conversations/:id/messages with pagination", async () => {
      mockOk({});
      await lgmFetch("/conversations/conv123/messages", "GET", undefined, { page: "0" });
      expect(lastUrl().pathname).toBe("/flow/conversations/conv123/messages");
      expect(lastUrl().searchParams.get("page")).toBe("0");
    });
  });
});

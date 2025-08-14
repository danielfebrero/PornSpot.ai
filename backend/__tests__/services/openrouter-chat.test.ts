import { OpenRouterService } from "@shared/services/openrouter-chat";

describe("OpenRouterService", () => {
  let service: OpenRouterService;

  beforeEach(() => {
    service = OpenRouterService.getInstance();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = OpenRouterService.getInstance();
      const instance2 = OpenRouterService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("getAvailableTemplates", () => {
    it("should return available instruction templates", () => {
      const templates = service.getAvailableTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toContain("prompt-optimization");
      expect(templates).toContain("example-template");
      expect(templates).toContain("content-moderation");
    });
  });

  describe("getTemplateDetails", () => {
    it("should return template details for existing templates", () => {
      const template = service.getTemplateDetails("prompt-optimization");
      expect(template).toBeDefined();
      expect(template?.name).toBe("prompt-optimization");
      expect(template?.systemInstructions).toContain("SDXL");
      expect(template?.variableInstructions).toBeDefined();
    });

    it("should return null for non-existing templates", () => {
      const template = service.getTemplateDetails("non-existing-template");
      expect(template).toBeNull();
    });
  });

  describe("chatCompletion", () => {
    // Note: This test would require a valid API key and network access
    // In a real test environment, you would mock the fetch call
    it("should throw error for invalid template", async () => {
      await expect(
        service.chatCompletion({
          instructionTemplate: "invalid-template",
          userMessage: "test message",
        })
      ).rejects.toThrow('Instruction template "invalid-template" not found');
    });
  });
});
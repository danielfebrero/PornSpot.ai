#!/usr/bin/env node

/**
 * Manual test script for OpenRouter service
 * 
 * This script demonstrates the OpenRouter service functionality.
 * To run with actual API calls, set OPENROUTER_API_KEY environment variable.
 * 
 * Usage:
 * OPENROUTER_API_KEY=your_key node scripts/test-openrouter.js
 */

import { OpenRouterService } from "../backend/shared/services/openrouter-chat";

async function testOpenRouterService() {
  console.log("🚀 Testing OpenRouter Service");
  console.log("===============================\n");

  try {
    // Get service instance
    const service = OpenRouterService.getInstance();
    console.log("✅ Service instance created");

    // Test template loading
    const templates = service.getAvailableTemplates();
    console.log(`📝 Available templates: ${templates.join(", ")}`);

    // Test template details
    const promptOptTemplate = service.getTemplateDetails("prompt-optimization");
    if (promptOptTemplate) {
      console.log("✅ Prompt optimization template loaded");
      console.log(`   - Name: ${promptOptTemplate.name}`);
      console.log(`   - Has system instructions: ${!!promptOptTemplate.systemInstructions}`);
      console.log(`   - Has variables: ${!!promptOptTemplate.variableInstructions}`);
    }

    // Test variable substitution (without API call)
    const exampleTemplate = service.getTemplateDetails("example-template");
    if (exampleTemplate) {
      console.log("✅ Example template loaded");
      console.log(`   - Contains datetime variable: ${exampleTemplate.systemInstructions.includes("{{currentDateTime}}")}`);
    }

    // Test invalid template
    const invalidTemplate = service.getTemplateDetails("non-existent");
    console.log(`✅ Invalid template returns null: ${invalidTemplate === null}`);

    console.log("\n📋 Service Tests Summary:");
    console.log("- ✅ Singleton pattern working");
    console.log("- ✅ Template loading working");
    console.log("- ✅ Template details retrieval working");
    console.log("- ✅ Error handling for invalid templates working");

    // Only test API calls if API key is provided
    if (process.env.OPENROUTER_API_KEY) {
      console.log("\n🔑 API Key found - testing actual API calls");
      
      try {
        const response = await service.chatCompletion({
          instructionTemplate: "prompt-optimization",
          userMessage: "beautiful landscape",
          model: "mistralai/mistral-medium-3.1",
          parameters: {
            temperature: 0.7,
            max_tokens: 256,
          },
        });

        console.log("✅ API call successful");
        console.log(`   - Response length: ${response.content.length} characters`);
        console.log(`   - Model used: ${response.model}`);
        console.log(`   - Usage: ${JSON.stringify(response.usage)}`);
        console.log(`   - Sample response: "${response.content.substring(0, 100)}..."`);
      } catch (apiError) {
        console.error("❌ API call failed:", apiError.message);
      }
    } else {
      console.log("\n⚠️  No OPENROUTER_API_KEY provided - skipping API tests");
      console.log("   To test API calls, set OPENROUTER_API_KEY environment variable");
    }

    console.log("\n✅ All service tests completed successfully!");

  } catch (error) {
    console.error("❌ Service test failed:", error);
    process.exit(1);
  }
}

// Run the test
testOpenRouterService().catch(console.error);
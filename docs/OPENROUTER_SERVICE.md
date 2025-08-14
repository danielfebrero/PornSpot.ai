# OpenRouter Chat Completion Service

## Overview

The OpenRouter Chat Completion Service provides a unified interface for integrating AI chat models from OpenRouter into PornSpot.ai functions. It supports both streaming and non-streaming completions with instruction templates and variable substitution.

## Features

- **Instruction Templates**: Reusable system prompts stored as text files
- **Variable Substitution**: Dynamic content injection (datetime, user info, etc.)
- **Streaming Support**: Real-time response streaming for interactive features
- **Model Flexibility**: Support for various OpenRouter models
- **Parameter Customization**: Configurable generation parameters per request
- **Error Handling**: Robust error handling with fallback mechanisms

## Setup

### 1. Environment Configuration

**Local Development:**
```bash
# Add to backend/.env.local.json
{
  "OPENROUTER_API_KEY": "your_openrouter_api_key_here"
}
```

**Production:**
```bash
# Store in AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/pornspot-ai/prod/openrouter-api-key" \
  --value "your_openrouter_api_key_here" \
  --type "SecureString"
```

### 2. Instruction Templates

Create `.txt` files in `/backend/shared/instructions/` with system instructions:

```txt
# Example: task-specific-template.txt
You are an expert in [domain].

Your task is to [specific task description].

Guidelines:
1. [Guideline 1]
2. [Guideline 2]

Current datetime: {{currentDateTime}}
User plan: {{userPlan}}

Return [expected format].
```

## Usage

### Basic Chat Completion

```typescript
import { OpenRouterService } from "@shared/services/openrouter-chat";

const openRouterService = OpenRouterService.getInstance();

const response = await openRouterService.chatCompletion({
  instructionTemplate: "prompt-optimization",
  userMessage: "beautiful landscape",
  model: "mistralai/mistral-medium-3.1", // optional
  parameters: {
    temperature: 0.7,
    max_tokens: 1024,
  },
  variables: {
    userPlan: "pro",
    customVar: "value"
  }
});

console.log(response.content);
```

### Streaming Chat Completion

```typescript
const streamGenerator = await openRouterService.chatCompletionStream({
  instructionTemplate: "content-moderation",
  userMessage: "Content to analyze",
  parameters: {
    temperature: 0.3,
  }
});

for await (const chunk of streamGenerator) {
  process.stdout.write(chunk);
}
```

### Available Instruction Templates

- **`prompt-optimization`**: Enhances user prompts for SDXL image generation
- **`content-moderation`**: Analyzes content for policy compliance
- **`example-template`**: Basic template with usage instructions

## Integration Examples

### Generation Function Integration

The service is already integrated into the generation function for prompt optimization:

```typescript
// In generate.ts
if (optimizePrompt) {
  try {
    const openRouterService = OpenRouterService.getInstance();
    
    const response = await openRouterService.chatCompletion({
      instructionTemplate: "prompt-optimization",
      userMessage: validatedPrompt.trim(),
      model: "mistralai/mistral-medium-3.1",
      parameters: {
        temperature: 0.7,
        max_tokens: 1024,
      },
    });
    
    optimizedPrompt = response.content.trim();
    finalPrompt = optimizedPrompt;
  } catch (error) {
    // Fallback to original prompt
  }
}
```

### Custom Function Integration

```typescript
import { LambdaHandlerUtil, AuthResult } from "@shared/utils/lambda-handler";
import { OpenRouterService } from "@shared/services/openrouter-chat";

const handleCustomTask = async (
  event: APIGatewayProxyEvent,
  auth: AuthResult
): Promise<APIGatewayProxyResult> => {
  const { userMessage } = LambdaHandlerUtil.parseJsonBody(event);
  
  const openRouterService = OpenRouterService.getInstance();
  
  const response = await openRouterService.chatCompletion({
    instructionTemplate: "content-moderation",
    userMessage,
    variables: {
      userName: auth.user?.name,
      userPlan: auth.user?.plan,
    }
  });
  
  return ResponseUtil.success(event, {
    analysis: response.content,
    usage: response.usage
  });
};

export const handler = LambdaHandlerUtil.withAuth(handleCustomTask);
```

## Creating Custom Instruction Templates

### Template Structure

```txt
# File: backend/shared/instructions/my-template.txt

You are a [role/expert].

Context: {{platformName}} is an adult content platform.
Current time: {{currentDateTime}}
User: {{userName}} ({{userPlan}} plan)

Task: [Specific task description]

Guidelines:
1. [Specific guideline]
2. [Another guideline]

Input format: [Expected input]
Output format: [Expected output]

[Additional context or examples]
```

### Built-in Variables

The service automatically provides these variables:

- `{{currentDateTime}}`: Current ISO timestamp
- `{{platformName}}`: "PornSpot.ai"

Custom variables can be passed via the `variables` parameter.

### Best Practices

1. **Be Specific**: Clear, detailed instructions yield better results
2. **Include Examples**: Show expected input/output formats
3. **Set Context**: Provide relevant domain context
4. **Define Constraints**: Specify limitations and requirements
5. **Handle Edge Cases**: Account for various input scenarios

## Supported Models

The service supports all OpenRouter models. Common choices:

- **`mistralai/mistral-medium-3.1`**: Balanced performance and cost
- **`anthropic/claude-3-sonnet`**: High-quality reasoning
- **`openai/gpt-4-turbo`**: Latest OpenAI model
- **`meta-llama/llama-3-70b`**: Open-source alternative

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const response = await openRouterService.chatCompletion(request);
  return response.content;
} catch (error) {
  if (error.message.includes("API error")) {
    // Handle API-specific errors
    console.error("OpenRouter API error:", error);
  } else if (error.message.includes("template")) {
    // Handle template errors
    console.error("Template error:", error);
  }
  
  // Fallback behavior
  return fallbackResponse;
}
```

## Monitoring and Costs

- **Usage Tracking**: Monitor token usage via response.usage
- **Cost Management**: Set appropriate max_tokens limits
- **Rate Limiting**: Implement user-based rate limiting if needed
- **Model Selection**: Choose cost-effective models for specific tasks

## Security Considerations

- **API Key Protection**: Store in Parameter Store with encryption
- **Input Validation**: Validate all user inputs before processing
- **Output Filtering**: Filter responses for inappropriate content
- **Rate Limiting**: Prevent abuse with proper rate limiting
- **Audit Logging**: Log all requests for compliance

## Future Enhancements

- **Template Versioning**: Version control for instruction templates
- **A/B Testing**: Compare different templates for effectiveness
- **Custom Model Fine-tuning**: Fine-tune models for specific tasks
- **Caching**: Cache responses for frequently asked questions
- **Analytics**: Track template performance and usage metrics
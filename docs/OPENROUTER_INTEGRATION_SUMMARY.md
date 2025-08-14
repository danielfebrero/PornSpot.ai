# OpenRouter Service Integration

## Summary

This implementation adds a comprehensive OpenRouter chat completion service to PornSpot.ai, enabling AI-powered features across various Lambda functions. The service has been successfully integrated into the generation function to replace frontend-based prompt optimization with robust backend processing.

## Key Components

### 1. Shared Types (`/shared-types/openrouter.ts`)
- Complete TypeScript interfaces for OpenRouter API
- Request/response types for chat completions
- Instruction template and service configuration types

### 2. OpenRouter Service (`/backend/shared/services/openrouter-chat.ts`)
- Singleton service class with comprehensive feature set
- Support for both streaming and non-streaming completions
- Instruction template loading and variable substitution
- Error handling and retry logic
- Parameter Store integration for secure API key management

### 3. Instruction Templates
- **`prompt-optimization.txt`**: SDXL prompt enhancement for image generation
- **`content-moderation.txt`**: Content analysis and policy compliance
- **`example-template.txt`**: Basic template with usage instructions

### 4. Integration with Generation Function
- Seamless integration into existing generation workflow
- Fallback to original prompt if optimization fails
- Returns optimized prompt in API response for transparency
- Uses `mistralai/mistral-medium-3.1` model for balance of quality and speed

## Configuration Requirements

### Environment Variables
```bash
# Local development
OPENROUTER_API_KEY=your_api_key_here

# Production (AWS Systems Manager Parameter Store)
/pornspot-ai/prod/openrouter-api-key (SecureString)
```

### API Permissions
The service includes proper headers for OpenRouter API:
- `HTTP-Referer: https://pornspot.ai`
- `X-Title: PornSpot.ai`

## Usage Examples

### Basic Prompt Optimization
```typescript
const service = OpenRouterService.getInstance();

const response = await service.chatCompletion({
  instructionTemplate: "prompt-optimization",
  userMessage: "beautiful woman",
  model: "mistralai/mistral-medium-3.1",
});

// Result: "beautiful woman, portrait, highly detailed face, professional photography..."
```

### Generation Function Integration
The service is automatically used when `optimizePrompt: true` in generation requests:

```json
{
  "prompt": "landscape",
  "optimizePrompt": true
}
```

Response includes both original and optimized prompts:
```json
{
  "queueId": "queue-123",
  "optimizedPrompt": "breathtaking landscape, golden hour lighting, dramatic sky..."
}
```

## Error Handling

The service includes comprehensive error handling:
- Invalid templates return clear error messages
- API failures fall back gracefully in generation function
- Network issues are logged but don't block core functionality
- Parameter Store errors are caught and reported

## Testing

### Unit Tests
- Service singleton pattern validation
- Template loading and management tests
- Error handling verification
- Variable substitution testing

### Manual Testing Script
Use `/scripts/test-openrouter.js` to validate service functionality:
```bash
# Test without API calls (template loading only)
node scripts/test-openrouter.js

# Test with API calls (requires key)
OPENROUTER_API_KEY=your_key node scripts/test-openrouter.js
```

## Performance Considerations

- **Caching**: API key is cached after first retrieval
- **Timeout Handling**: Network timeouts with appropriate fallbacks
- **Resource Management**: Proper stream cleanup in streaming mode
- **Token Limits**: Configurable max_tokens to control costs

## Security Features

- **Secure Parameter Storage**: API keys stored encrypted in Parameter Store
- **Input Validation**: All user inputs validated before processing
- **Error Information**: API errors logged but not exposed to users
- **Rate Limiting**: Compatible with existing rate limiting infrastructure

## Migration Notes

### Frontend Changes Required
The frontend should now expect `optimizedPrompt` in generation responses and can display this to users for transparency. The previous client-side prompt optimization demo can be removed.

### Deployment Requirements
1. Store OpenRouter API key in Parameter Store
2. Deploy updated Lambda functions
3. Verify service initialization in CloudWatch logs

## Future Enhancements

### Short Term
- Additional instruction templates for specific use cases
- A/B testing framework for template effectiveness
- Usage analytics and cost monitoring

### Long Term
- Custom model fine-tuning for platform-specific tasks
- Real-time streaming responses for interactive features
- Multi-model fallback strategies for reliability

## Documentation References

- **[OPENROUTER_SERVICE.md](./OPENROUTER_SERVICE.md)**: Complete API documentation
- **[SHARED_UTILITIES.md](./SHARED_UTILITIES.md)**: Updated with service integration
- **OpenRouter API Docs**: https://openrouter.ai/docs

## Success Metrics

The implementation successfully:
- ✅ Replaces frontend prompt optimization with backend processing
- ✅ Maintains backward compatibility with existing generation API
- ✅ Provides extensible template system for future features
- ✅ Includes comprehensive error handling and logging
- ✅ Follows established patterns from existing shared services
- ✅ Passes TypeScript strict mode and ESLint validation
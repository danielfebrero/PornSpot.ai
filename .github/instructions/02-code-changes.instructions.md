---
applyTo: "**"
---

# Code Change Instructions (v2)

## Surgical Change Philosophy
Your changes should be **surgical and precise** - the smallest possible modifications to achieve the goal while maintaining system integrity.

## Critical Rules

### 1. Minimal Impact Strategy
- **Change as few lines as possible** to achieve the goal
- **NEVER delete/remove/modify working code** unless absolutely necessary
- **Preserve existing functionality** - validate changes don't break behavior
- **Focus on the specific task** - ignore unrelated bugs or broken tests

### 2. Responsibility Boundaries
- **Fix only issues related to your task** - don't fix unrelated problems
- **If build/test failures exist**, only fix ones directly related to your changes
- **Document changes** if directly related to your modifications
- **Use report_progress tool** for all git operations - never commit directly

### 3. Planning & Review Process
- **Use think tool** to plan changes before implementation
- **Review changes made** - use think tool if too much deletion is happening
- **Change plans dynamically** based on discovered complexity
- **Validate impact** before and after each change

## PornSpot.ai Specific Patterns

### 4. Architecture Compliance
- **Respect single-table DynamoDB design** - use GSIs for queries
- **Follow serverless patterns** - optimize for cold starts
- **Use ResponseUtil** for consistent Lambda responses
- **Include CORS headers** in all API responses

### 5. Frontend Consistency
- **Use centralized API methods** from `/frontend/src/lib/api.ts` - never direct fetch
- **Use LocaleLink/useLocaleRouter** for navigation - never direct Next.js Link/router
- **Use ResponsivePicture component** for images - never Next.js Image component
- **Check permissions** before rendering features using usePermissions hook

### 6. Type Safety & Shared Resources
- **Edit shared types** only in `/shared-types/` directory
- **Run `npm run copy:shared-types`** after type changes
- **Maintain type consistency** across backend and frontend
- **Use TypeScript strict mode** for all new code

## Change Validation Process

### 7. Testing Strategy
- **Run existing lints/builds/tests** before making changes
- **Test changes immediately** after implementation
- **Create focused tests** for your specific changes if infrastructure exists
- **Manual verification** of CLI/server apps and UI changes
- **Screenshot UI changes** to show visual impact

### 8. Incremental Development
- **Make small, incremental changes** 
- **Use report_progress** after each verified change
- **Review committed files** to ensure minimal scope
- **Use .gitignore** to exclude build artifacts and dependencies

## Quality Gates
- [ ] Code follows existing patterns and conventions
- [ ] Proper error handling and logging implemented
- [ ] Tests written and passing (if test infrastructure exists)
- [ ] Documentation updated if needed
- [ ] Performance implications considered
- [ ] Security implications reviewed
- [ ] `/docs` files updated to reflect changes or new knowledge
- [ ] API patterns use centralized methods
- [ ] Navigation uses LocaleLink/useLocaleRouter components
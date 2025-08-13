---
applyTo: "**"
---

# Tool Usage Instructions (v2)

## Strategic Tool Usage Philosophy
Leverage the comprehensive tool ecosystem effectively to maximize development efficiency, code quality, and project understanding while working within the PornSpot.ai serverless architecture.

## 🧠 Advanced Planning & Analysis

### 1. Think Tool - Strategic Reasoning
**Use before any significant action** to:
- **Analyze complex problems** - break down multi-faceted issues into manageable components
- **Plan implementation strategy** - consider architectural implications and dependencies
- **Review and reflect** on changes made to ensure precision and avoid over-deletion
- **Brainstorm solutions** - generate multiple approaches and assess trade-offs
- **Evaluate changes impact** - understand how modifications affect the broader codebase

**Best practices:**
- Be thorough and comprehensive in your thinking
- Consider edge cases and error scenarios
- Evaluate architectural compliance with PornSpot.ai patterns
- Plan for maintainability and future extensibility
- Length is not a concern - depth of analysis is valuable

### 2. Context Gathering Strategy
**Before implementation, gather comprehensive context:**
- **Search existing patterns** - look for similar implementations to follow
- **Understand file relationships** - identify dependencies and interactions
- **Analyze architecture compliance** - ensure changes fit system design
- **Identify reusable components** - avoid duplication through pattern recognition

## 🔧 Development Tools Mastery

### 3. Bash Tool - Command Execution Excellence
**Primary tool for system operations with sophisticated usage patterns:**

**Async vs Sync Execution:**
```bash
# Use async=false for long-running operations (2+ minutes)
npm run build                    # timeout: 300, async: false
npm run test:ci                  # timeout: 200, async: false  

# Use async=true for interactive tools and daemons
npm run dev:frontend            # async: true for ongoing development
node --inspect debugging.js     # async: true for debugging sessions

# Note: Local backend API not supported due to Docker images
```

**Interactive Tool Mastery:**
```bash
# Step 1: Start interactive tool
bash command: `npm run interactive-setup` 
sessionId: "setup", async: true

# Step 2: Send input with keyboard navigation
write_bash input: `{down}{down}{enter}` 
sessionId: "setup", delay: 30

# Step 3: Complex input combinations
write_bash input: `my-project-name{enter}{down}{space}{enter}`
sessionId: "setup", delay: 20
```

**Command Chaining for Efficiency:**
```bash
# PornSpot.ai specific chains
npm run clean:sam && npm run build:backend && sam build
git --no-pager status && git --no-pager diff
npm run copy:shared-types && npm run type-check
npm run lint:fix && npm run test:unit && npm run build
```

**Critical Bash Guidelines:**
- **Disable pagers** - use `git --no-pager`, `less -F`, or pipe to `| cat`
- **Adequate timeouts** - long builds and tests need appropriate time limits
- **Session management** - use consistent sessionIds for related operations
- **Error handling** - check exit codes and handle failures gracefully

### 4. File Operation Tools - Precision Editing

**Strategic File Management:**
- **Never recreate existing files** - use `view` then `str_replace` to edit
- **Large meaningful chunks** - read substantial sections rather than small bits
- **Absolute paths always** - use full paths for all file operations
- **Temporary files in /tmp** - keep temporary work separate from repository

**PornSpot.ai Specific Patterns:**
```typescript
// Always check for existing patterns first
str_replace_editor command: view path: /home/runner/work/PornSpot.ai/PornSpot.ai/frontend/src/components/ui/

// Read related files to understand context
str_replace_editor command: view path: /home/runner/work/PornSpot.ai/PornSpot.ai/frontend/src/lib/api.ts

// Make targeted changes
str_replace_editor command: str_replace 
path: /home/runner/work/PornSpot.ai/PornSpot.ai/frontend/src/components/MyComponent.tsx
old_str: "existing code block"
new_str: "improved code block"
```

## 🔍 Analysis & Discovery Tools

### 5. Code Exploration Strategy
**Parallel tool usage for maximum efficiency:**
- **Multiple file reads** - use parallel calls to understand related components
- **Directory exploration** - view multiple related directories simultaneously  
- **Pattern analysis** - search for similar implementations across the codebase
- **Dependency tracking** - understand how components interact

**Example parallel exploration:**
```bash
# Gather complete context in parallel
str_replace_editor view /home/runner/work/PornSpot.ai/PornSpot.ai/frontend/src/components/
str_replace_editor view /home/runner/work/PornSpot.ai/PornSpot.ai/backend/functions/
str_replace_editor view /home/runner/work/PornSpot.ai/PornSpot.ai/shared-types/
str_replace_editor view /home/runner/work/PornSpot.ai/PornSpot.ai/docs/
```

## 📊 PornSpot.ai Specific Tool Patterns

### 6. Development Workflow Tools
**Local Development Setup:**
```bash
# Dependencies and environment
npm run install:all
cp frontend/.env.example frontend/.env.local
cp backend/.env.example.json backend/.env.local.json

# Frontend development only
npm run dev:frontend

# Note: Backend requires AWS deployment due to Docker images
```

**Type Management:**
```bash
# Always use the centralized type system
str_replace_editor view /home/runner/work/PornSpot.ai/PornSpot.ai/shared-types/
# Make changes in shared-types, then:
npm run copy:shared-types
npm run type-check
```

**Testing & Quality:**
```bash
# Comprehensive testing workflow
npm run lint:fix
npm run type-check  
npm run test:backend:unit
npm run test:frontend:unit
npm run build
```

### 7. Architecture-Specific Patterns
**DynamoDB & Lambda:**
```bash
# Local testing setup
./scripts/init-local-aws.sh
npm run db:setup
npm run local:start

# Frontend deployment and testing
npm run build:frontend
npm run test:frontend

# Note: Backend development requires AWS deployment
```

**Permission System Integration:**
```typescript
// Always check permissions before feature access
const { canCreatePrivateContent, canGenerateImages } = usePermissions();
if (canCreatePrivateContent()) {
  // Render premium features
}
```

## 🎯 Best Practices & Tips

### 8. Efficiency Maximization
- **Reflect after commands** - analyze output before proceeding to next step
- **Use temporary directories** - `/tmp` for experiments and iterations
- **Validate edge cases** - ensure changes handle boundary conditions
- **Ask for guidance** - when confidence is low, communicate with user

### 9. Quality Assurance Integration
- **Immediate validation** - test changes as soon as they're made
- **Iterative improvement** - make small changes and validate continuously
- **Documentation updates** - maintain docs alongside code changes
- **Pattern compliance** - ensure new code follows established conventions

### 10. Error Recovery & Learning
- **Learn from failures** - analyze what went wrong and adjust approach
- **Use git for recovery** - `git checkout <file>` to revert problematic changes
- **Validate assumptions** - check that understanding matches reality
- **Document solutions** - help future development with lessons learned

## 🚀 Advanced Tool Combinations

### 11. Complex Workflow Examples
**Full Feature Implementation:**
```bash
# 1. Analysis phase
think "Analyze the feature requirements and existing patterns"
str_replace_editor view /path/to/related/components (parallel)

# 2. Implementation phase  
str_replace_editor create /path/to/new/component
npm run lint:fix
npm run type-check

# 3. Testing phase
npm run test:unit
bash command: "npm run dev:frontend" async: true
# Manual testing...

# 4. Documentation and completion
str_replace_editor str_replace /docs/relevant-documentation.md
report_progress "Implement new feature with comprehensive testing"
```

**Debugging Workflow:**
```bash
# 1. Gather diagnostic information
git --no-pager status && git --no-pager diff
npm run test:backend:unit 2>&1 | head -50
grep -r "error pattern" backend/ --include="*.ts"

# 2. Interactive debugging
bash command: "node --inspect backend/functions/problematic-function.js" async: true
write_bash input: "console.log(debugInfo){enter}"

# 3. Solution validation  
str_replace_editor str_replace problematic-file
npm run test:backend:unit
npm run lint
```

The key to mastery is combining these tools strategically to achieve maximum efficiency while maintaining code quality and architectural compliance.
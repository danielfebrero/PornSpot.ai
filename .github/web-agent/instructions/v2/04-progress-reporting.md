# Progress Reporting Instructions (v2)

## Strategic Progress Communication
Progress reporting is critical for stakeholder visibility, code integrity, and collaborative development. Use the **report_progress** tool to maintain transparent communication throughout the development process.

## Core Reporting Principles

### 1. Proactive Communication
- **Report at start** - share initial plan as a detailed checklist before making any changes
- **Report frequently** - commit and push changes to maintain PR synchronization
- **Report meaningful progress** - update when completing significant units of work
- **Report status updates** - keep stakeholders informed of remaining work and any blockers

### 2. Structured Progress Tracking
- **Use markdown checklists** for clear progress visualization:
  - `- [x]` for completed items
  - `- [ ]` for pending items  
  - `- [!]` for blocked items (optional)
- **Maintain consistent structure** between updates while staying accurate and useful
- **Update task details** as understanding evolves without changing overall structure
- **Group related tasks** logically for better readability

## Report Progress Tool Usage

### 3. When to Report Progress
✅ **ALWAYS report in these situations:**
- **Initial planning** - outline complete plan as checklist before starting
- **Meaningful unit completion** - finished a significant piece of work
- **Plan updates needed** - checklist requires modification based on discoveries
- **Code changes ready** - changes are tested and ready for commit
- **Milestone completion** - finished major phase or component
- **Before major changes** - significant architectural decisions or refactoring

❌ **AVOID reporting for:**
- Minor file reads or explorations
- Temporary or experimental changes
- Work in progress that isn't tested
- Frequent micro-updates that add noise

### 4. Quality Assurance for Commits
- **Review committed files** to ensure minimal and expected scope
- **Use .gitignore** to exclude build artifacts (`node_modules`, `dist`, `.next`, `.turbo`)
- **Validate file changes** match the intended scope of work
- **Check for accidental inclusions** of temporary files or debug code
- **Ensure documentation updates** are included when relevant

## PornSpot.ai Specific Reporting Patterns

### 5. Project-Specific Checklist Categories
Structure your checklists using these categories for consistency:

**Architecture & Setup**
- [ ] Repository exploration and context gathering
- [ ] Dependency installation and environment setup
- [ ] Build and test validation

**Analysis & Planning** 
- [ ] Issue/requirement analysis
- [ ] Existing pattern identification
- [ ] Architecture compliance validation
- [ ] Minimal change strategy definition

**Implementation**
- [ ] Core logic implementation
- [ ] Frontend component updates (if applicable)
- [ ] Backend Lambda updates (if applicable)
- [ ] Database schema changes (if applicable)

**Quality Assurance**
- [ ] TypeScript type checking
- [ ] ESLint validation
- [ ] Test execution and validation
- [ ] Manual testing and verification

**Documentation & Integration**
- [ ] Documentation updates
- [ ] Integration testing
- [ ] Performance validation
- [ ] Security review

### 6. Effective Commit Messages
Use clear, actionable commit messages that describe the specific change:
```
✅ Good examples:
"Add permission check to album creation form"
"Fix DynamoDB GSI query for public albums"
"Update shared types for new media metadata"
"Implement responsive image component with thumbnails"

❌ Poor examples:
"Update files"
"Fix bug"
"Progress update"
"Changes"
```

## Communication Standards

### 7. PR Description Guidelines
- **No headers** - use only markdown checklists
- **Concise descriptions** - focus on what's changing and why
- **Technical context** - include relevant architectural decisions
- **Progress visibility** - show completed and remaining work clearly
- **Link related issues** - reference relevant GitHub issues or discussions

### 8. Collaborative Development
- **Maintain context** for team members reviewing the PR
- **Explain architectural decisions** that affect broader system design
- **Document breaking changes** and migration requirements
- **Highlight security implications** of changes
- **Note performance impacts** for serverless optimization

## Advanced Reporting Strategies

### 9. Handling Complex Changes
For complex or multi-phase work:
- **Break into logical phases** with separate progress reports
- **Use nested checklists** for sub-tasks within major items
- **Report intermediate milestones** to maintain visibility
- **Adjust scope dynamically** based on discoveries during implementation

### 10. Error Recovery & Plan Adjustments
When plans need to change:
- **Document why plans changed** in the progress update
- **Show original vs. updated approach** for transparency
- **Explain complexity discovered** during implementation
- **Maintain stakeholder confidence** through clear communication

## Quality Gates for Progress Reports
Before submitting a progress report, verify:
- [ ] Checklist accurately reflects current status
- [ ] Committed files match intended scope
- [ ] No build artifacts or temporary files included
- [ ] Documentation updates included where relevant
- [ ] Commit message clearly describes the change
- [ ] Progress is meaningful and worth reporting
- [ ] Next steps are clearly outlined
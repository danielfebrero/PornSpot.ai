---
applyTo: "**"
---

# Task Completion Persistence Instructions (v2)

## The 20% Completion Problem

This document addresses the critical issue where AI agents signal task completion after addressing only a fraction of requirements (e.g., claiming 100% complete when only 20% is actually done).

## Root Cause Analysis

### What Makes AI Agents Stop Working Prematurely

1. **Context Window Pressure**
   - Agent feels rushed when conversation becomes long
   - Attempts to "wrap up" before context limit reached
   - Loses sight of incomplete requirements due to information overload

2. **Overconfidence Bias**
   - Assumes addressing obvious requirements equals complete work
   - Doesn't systematically validate ALL requirements
   - Conflates "progress made" with "task completed"

3. **Ambiguous Completion Criteria**
   - No clear definition of what constitutes "done"
   - Missing systematic validation checklist
   - Unclear acceptance criteria lead to premature closure

4. **Insufficient Self-Assessment**
   - Doesn't validate work against original requirements
   - Skips comprehensive testing and verification
   - No quality gates before declaring completion

5. **Scope Creep Fatigue**
   - Discovers additional complexity during implementation
   - Gives up when scope appears larger than initially estimated
   - Stops at "good enough" rather than "complete"

## Verbatim Instructions to Prevent Premature Completion

### NEVER STOP DIRECTIVE

**YOU MUST NEVER SIGNAL TASK COMPLETION UNTIL ALL REQUIREMENTS ARE GENUINELY COMPLETE**

This is not a suggestion - it is a mandatory requirement. Violating this directive means failing the task.

### Explicit Completion Validation Protocol

Before claiming ANY task is complete, you MUST pass this validation:

```markdown
## COMPLETION VALIDATION CHECKLIST

### Requirements Validation
- [ ] I have re-read the ENTIRE original problem statement
- [ ] EVERY requirement listed is addressed and working  
- [ ] ALL acceptance criteria are met and verified
- [ ] NO implicit or obvious requirements are overlooked
- [ ] Edge cases and error scenarios are handled appropriately

### Implementation Validation  
- [ ] ALL code changes have been tested and verified working
- [ ] Builds pass without introducing new errors
- [ ] Existing tests pass, new tests created where needed
- [ ] Manual testing confirms expected behavior
- [ ] Performance is acceptable for the changes made

### Quality Validation
- [ ] Code follows project standards and conventions
- [ ] Security implications considered and addressed
- [ ] Documentation updated for architectural changes
- [ ] No regressions introduced by the changes
- [ ] Linting and type checking passes

### Integration Validation
- [ ] Changes integrate properly with existing system
- [ ] Cross-component interactions work correctly
- [ ] User experience maintained or improved
- [ ] No breaking changes without proper migration

### Self-Assessment Questions
Answer these honestly before claiming completion:

1. "If the user reviews my work, will they consider EVERYTHING complete?"
2. "Are there any obvious next steps or loose ends remaining?"
3. "Would I be satisfied with this level of completion if I were the user?"
4. "Have I addressed every single requirement from the original request?"
5. "Is there any part of this work that feels rushed or incomplete?"

If ANY answer is "no" or "uncertain", the task is NOT complete.
```

### Context Management Protocol

When context becomes full during extensive tasks:

**NEVER abandon the work** - Use this protocol instead:

```markdown
**CONTEXT MANAGEMENT REQUIRED - TASK INCOMPLETE**

**ORIGINAL REQUIREMENTS ANALYSIS:**
[Re-list every requirement from the original problem statement]

**COMPLETION STATUS BY REQUIREMENT:**
- ✅ Requirement 1: [Specific description] - COMPLETE with verification
- 🔄 Requirement 2: [Specific description] - IN PROGRESS [what remains]
- ❌ Requirement 3: [Specific description] - NOT STARTED
- 📋 Requirement 4: [Newly discovered] - ADDITIONAL SCOPE

**VERIFIED COMPLETED WORK:**
[Only list items that are 100% complete and tested]

**REMAINING WORK (SPECIFIC ACTIONS NEEDED):**
- [Actionable item 1 with clear success criteria]
- [Actionable item 2 with clear success criteria]
- [Etc.]

**OVERALL COMPLETION PERCENTAGE:** [X]% - Based on requirements analysis above

**CONTEXT HANDOFF REQUEST:**
This task requires significant additional work to be complete. 
Context window is approaching limits.

COMMITMENT: I will NOT abandon this work. Please advise:
1. Continue in fresh context using this handoff information?
2. Prioritize specific remaining requirements?
3. Break into smaller sub-tasks with clear boundaries?

I WILL NOT CLAIM COMPLETION UNTIL ALL REQUIREMENTS ARE MET.
```

## How to Make AI Continue Working

### For Users: Ensuring Task Completion

**When an AI claims completion prematurely:**

1. **Challenge the completion claim:**
   ```
   Please review the original requirements and confirm that EVERY 
   requirement has been addressed. Provide the completion validation 
   checklist as proof.
   ```

2. **Request specific verification:**
   ```
   Show me evidence that requirement [X] is complete. Test it and 
   demonstrate that it works as specified.
   ```

3. **Demand continuation:**
   ```
   This task is not complete. Please continue working on the remaining 
   items: [list specific items]. Do not stop until ALL requirements 
   are met.
   ```

4. **Use context management:**
   ```
   If context is full, provide a comprehensive handoff and continue 
   in a fresh context. Do not abandon this work.
   ```

### For AI: Self-Correction Protocol

**When you realize you stopped prematurely:**

1. **Acknowledge the incomplete status:**
   ```
   I realize I prematurely signaled completion. This task is NOT complete.
   ```

2. **Provide honest assessment:**
   ```
   Current completion status: [X]% based on [specific analysis]
   Remaining work: [specific items with clear success criteria]
   ```

3. **Request continuation guidance:**
   ```
   I am committed to completing ALL requirements. How would you like 
   me to proceed with the remaining work?
   ```

4. **Continue systematically:**
   - Work through remaining items one by one
   - Validate each item before marking complete
   - Report progress frequently
   - Only claim completion after full validation

## Quality Gates for Task Completion

### Before Claiming Completion

1. **Requirements Traceability**
   - Can trace every requirement to specific implementation
   - Have tested each requirement individually
   - Can demonstrate each requirement working

2. **Comprehensive Testing**
   - Unit tests for new functionality
   - Integration tests for system interactions
   - Manual testing for user experience
   - Edge case validation

3. **Documentation Currency**
   - README updated if user-facing changes
   - API docs updated if endpoints changed
   - Architecture docs updated if system changes
   - Code comments explain complex logic

4. **Zero Regression Validation**
   - All existing tests still pass
   - No new linting or build errors
   - Performance not degraded
   - Security not compromised

### Red Flags - NEVER Complete If Present

❌ **Incomplete Indicators:**
- "This should work" (uncertainty language)
- "Most requirements are addressed" (partial completion)
- "The main functionality is done" (ignoring details)
- "I've made good progress" (progress ≠ completion)
- "This covers the basic use case" (missing edge cases)
- "I think this is what you wanted" (assumptions about requirements)

✅ **Completion Indicators:**
- "All requirements verified working" (certainty with evidence)
- "Every acceptance criterion tested and confirmed" (comprehensive validation)
- "No remaining work items" (genuinely complete)
- "All quality gates passed" (systematic validation)
- "Ready for production use" (confidence in completeness)

## Emergency Protocols

### When Scope Explodes

If you discover the task is much larger than initially apparent:

1. **Do NOT abandon the work**
2. **Analyze and communicate scope clearly:**
   ```markdown
   **SCOPE ANALYSIS UPDATE**
   
   Original estimated scope: [X]
   Discovered actual scope: [Y] 
   Reason for difference: [specific explanation]
   
   **OPTIONS:**
   1. Continue with full scope: [time/effort estimate]
   2. Prioritize core requirements: [list priorities]
   3. Phase the work: [suggest phases]
   
   **RECOMMENDATION:** [Your professional recommendation]
   
   I remain committed to delivering complete, quality work.
   ```

### When Blocked by Dependencies

1. **Identify and document blockers clearly**
2. **Continue with non-blocked work**
3. **Provide specific questions for resolution**
4. **Do NOT claim completion while blocked**

### When Context Approaches Limits

1. **Proactively manage before hitting limits**
2. **Summarize comprehensively**
3. **Request continuation guidance**
4. **Maintain commitment to completion**

## Success Metrics

A task is successfully completed when:
- User expresses satisfaction with ALL requirements met
- No obvious next steps or improvements needed
- System works reliably in intended environment
- Documentation accurately reflects implementation
- Quality standards maintained throughout
- All stakeholders consider work genuinely complete

Remember: **Your professional reputation depends on delivering complete, quality work. Never compromise on thoroughness.**
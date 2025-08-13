# Implicit Training Knowledge (Original)

## Software Engineering Principles from Training

### Code Quality Fundamentals
- **Single Responsibility Principle** - Each function/class should have one reason to change
- **DRY (Don't Repeat Yourself)** - Avoid code duplication through abstraction
- **KISS (Keep It Simple, Stupid)** - Prefer simple solutions over complex ones
- **YAGNI (You Aren't Gonna Need It)** - Don't build features until they're needed
- **Composition over Inheritance** - Favor object composition over class inheritance

### Problem-Solving Methodology
1. **Understand the Problem** - Read requirements thoroughly before coding
2. **Break Down Complex Tasks** - Divide large problems into smaller, manageable pieces
3. **Research Existing Solutions** - Look for established patterns and libraries
4. **Plan Before Implementation** - Think through the approach before writing code
5. **Iterate and Refine** - Start with working solution, then optimize

### Code Review Principles
- **Look for Logic Errors** - Check for off-by-one errors, null pointer issues
- **Security Vulnerabilities** - Input validation, SQL injection, XSS prevention
- **Performance Issues** - O(n²) algorithms, memory leaks, unnecessary operations
- **Maintainability** - Clear naming, proper documentation, consistent style
- **Test Coverage** - Ensure critical paths have adequate testing

### Testing Strategies
- **Test-Driven Development** - Write tests before implementation when beneficial
- **Unit Tests** - Test individual functions and methods in isolation
- **Integration Tests** - Test component interactions and API endpoints
- **Edge Cases** - Test boundary conditions, error states, invalid inputs
- **Regression Tests** - Prevent old bugs from reappearing

### Error Handling Patterns
- **Fail Fast** - Detect errors early and close to their source
- **Graceful Degradation** - Application should continue functioning when possible
- **Meaningful Error Messages** - Help users and developers understand what went wrong
- **Logging Strategy** - Log errors with context for debugging
- **Recovery Mechanisms** - Implement retry logic and fallbacks where appropriate

### Security Awareness
- **Input Validation** - Never trust user input, validate and sanitize
- **Authentication/Authorization** - Verify identity and permissions properly
- **Data Protection** - Encrypt sensitive data in transit and at rest
- **Least Privilege** - Grant minimum necessary permissions
- **Regular Updates** - Keep dependencies and systems up to date

### Performance Optimization
- **Premature Optimization is Evil** - Profile before optimizing
- **Database Query Optimization** - Use indexes, avoid N+1 queries
- **Caching Strategies** - Cache expensive operations and frequently accessed data
- **Lazy Loading** - Load resources only when needed
- **Bundle Optimization** - Minimize payload size for web applications

### Communication Patterns
- **Clear Commit Messages** - Explain what and why, not just what
- **Meaningful Variable Names** - Code should be self-documenting
- **Progressive Disclosure** - Present information in digestible chunks
- **Context in Questions** - Provide enough background for effective help
- **Constructive Feedback** - Focus on the code, not the person

### Documentation Practices
- **README First** - Write documentation that helps users get started quickly
- **API Documentation** - Document endpoints, parameters, and responses
- **Code Comments** - Explain why, not what (code explains what)
- **Architecture Decisions** - Document significant design choices and trade-offs
- **Keep Documentation Current** - Update docs when code changes
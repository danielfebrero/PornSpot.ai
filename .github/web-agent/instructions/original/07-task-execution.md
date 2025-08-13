# Task Execution Strategy (Original)

## Steps to Follow
0. Fully understand the issue and comments provided before making any changes
1. Explore the repo and files to fully understand the code before making any changes, including understanding how to lint, build and test the areas of the code you are working on. You are starting in a fresh clone of the repository, so build and run tests to check the current state of the code.

2. Run **report_progress** to outline your minimal-change plan as a checklist
3. Create focused tests that specifically validate your minimal changes. These tests should be consistent with existing tests in the repository. If there is not existing test infrastructure, you can skip adding tests as part of your instructions to make minimal modifications.
4. Lint, build and test your changes frequently and iteratively, ensuring tests align with expected outcomes.
5. Manually verify changes that you make to ensure they accomplish your goals. Run CLI/server apps, exercise new codepaths, and review the output to ensure that they are working properly. **ALWAYS** take a screenshot of any UI changes so the user can see the impact of the change.
6. Make small, incremental changes, using **report_progress** after each verified change. Review files committed by **report_progress** and use `.gitignore` to exclude any files that you don't want to include in the PR like tmp files, build artifacts or dependencies.

## Quality Assurance
Ensure that you lint, build and test early and iteratively to validate each code change thoroughly.

## Examples of Task Approaches

### Example 1: Issue Resolution
An issue needs to be addressed in the codebase.
- Get a list of tools from the ecosystem that automate parts of the task.
    * List scaffolding tools, like npm init, when creating a new application or component.
    * Identify package manager commands, like npm install, that you could run when updating project dependencies.
    * Enumerate refactoring tools that can help with this task.
    * Identify linters and checkers, like eslint, that you can use to validate code style and correctness.
- If a task can't be done with tools, get a list of files that need to be updated.
    * Find the files related to the issue.
    * Read the files to get the parts that need to be updated
- Build the code to see if it is buildable.
- Create tests to check if the issue exists
    * Check if there is an existing test that can be updated first.
    * If none exists, check if there are any tests and add a new test there for this issue.
    * If there are no tests, create a new test script for this issue only.
- Run the test to see if it fails.
- Edit the files to fix the issue. Make minimal changes to the files to fix the issue. Reason out why the change is needed and can a smaller change be made.
- Build the code and fix any NEW build errors that are introduced by the changes.
- Run the test you created to see if it passes. Do NOT modify any code to get any test other than the new one to pass.

### Example 2: Change Review and Adjustment
Changes made did not work, plan out how to approach the changes differently.
- Review the changes made via `git diff`.
    * What was related to the issue, and what was not and why?
    * Should any change be reverted? Only use `git checkout <file>` to revert changes.
- Check if the changes are too large
    * Run `git diff --numstat` to see the number of lines changed
    * Check the number of lines deleted and lines inserted per file. Deleted lines should be < twice the number of lines inserted.
    * Calculate if too much deletion is happening, for each file
    * `git checkout <file>` if too much deletion is happening
- Plan out what to do differently in detail, what files need to be edited, what commands to run and why.
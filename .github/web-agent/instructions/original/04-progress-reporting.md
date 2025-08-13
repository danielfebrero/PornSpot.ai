# Progress Reporting Instructions (Original)

## Progress Reporting Guidelines
* Use **report_progress** at the start before making any changes to share your initial plan as a checklist.
* Use **report_progress** frequently to commit and push your changes to the PR.
* Use **report_progress** frequently to:
  - Report completion of meaningful units of work
  - Update status on remaining work
  - Keep stakeholders informed of your progress
* Use markdown checklists to track progress (- [x] completed, - [ ] pending)
* Keep the checklist structure consistent between updates
* Review the files committed by **report_progress** to ensure the scope of the changes is minimal and expected. Use `.gitignore` to exclude files that are build artifacts or dependencies like `node_modules` or `dist`.

## Report Progress Tool Usage
Report progress on the task. Call when you complete a meaningful unit of work. Commits and pushes changes that are pending in the repo, then updates the PR description.
* Use this tool at least once, and as early as possible once you've established a plan. Outline the complete plan as a checklist.
* Use only when you have meaningful progress to report (you need to update the plan in the checklist, you have code changes to commit, or you have completed a new item in the checklist)
* Use markdown checklists to show progress (- [x] for completed items, - [ ] for pending items).
* Keep the checklist structure as consistent as you can between updates, while still being accurate and useful.
* Don't use headers in the PR description, just the checklist.
* If there are changes in the repo this tool will run `git add .`, `git commit -m <msg>`, and `git push`.
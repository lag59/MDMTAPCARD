# Project Instructions

## ChangAIs Report Generation

When making any workspace change in this project, you must update `.changais/report.json` with notes for human review. The report is part of the work, not an optional follow-up.

### Report File Format

```json
{
  "version": "1.0",
  "generatedAt": "ISO-8601 timestamp",
  "notes": [
    {
      "id": "unique-id",
      "file": "relative/path/to/file.ts",
      "line": 42,
      "endLine": 45,
      "type": "suggestion | warning | info",
      "title": "Short title",
      "content": "Detailed explanation of the change or concern",
      "checked": false
    }
  ]
}
```

### Note Types

- **suggestion**: Improvement recommendations, alternative approaches, or optional enhancements
- **warning**: Potential issues, security concerns, or things that need attention
- **info**: Explanations of why a change was made, context, or documentation

### When to Update the Report

1. **Replace the entire report** when starting new changes - don't append to old notes, create a fresh report
2. **Create the `.changais/` directory** if it doesn't exist
3. **Add at least one note for every path you touch**. No change is too small: created, modified, deleted, moved, or renamed paths all need notes, including config, generated, ignored, and deleted files. For each note, include:
   - What changed
   - Why it changed
   - Any trade-offs or decisions made
   - Potential issues or areas needing review
   - Suggestions for future improvements
   - Validation you ran or why validation was not run
4. **Update `generatedAt`** timestamp to current time
5. **Use unique IDs** for notes (e.g., "note-1", "note-2", or descriptive IDs like "auth-fix-1")

### Line Number Accuracy

Line numbers must pinpoint the actual changed code - this is how notes get pinned to the right place in the diff viewer.

- **`line`**: The exact line number in the **current version of the file** where your change begins. Use the line you are actually editing or inserting - do **not** default to line 1 unless the change genuinely starts there.
- **`endLine`**: The last line of the changed block (optional; omit for single-line changes).

### Acting on Review Feedback

When the user asks you to act on changAIs review feedback:

1. Read `.changais/prompt.md` for the instructions - if it contains a **User Message** section, treat it as the developer's top-priority request and address it first
2. Read `.changais/report.json` for the AI notes
3. Read `.changais/replies.json` for the developer's responses to each note

For each reply:

- `agree` / `will-fix` - make the requested code change
- `question` - answer the developer's question
- `disagree` - explain your reasoning or reconsider the note

After acting, update `.changais/report.json` with fresh notes for the current state of the code.

### Important

- **Always replace** the report content with fresh notes for the current changes
- Compare the existing report with the **current uncommitted diff** on every generation and remove notes for changes that are no longer present, including changes that have **already been committed**
- **Do not preserve** old notes from previous sessions - each report should only contain notes for the current uncommitted changes
- If no uncommitted changes remain, write a valid report with `"notes": []`; **do not delete the report file**
- The extension keeps the report after git commits so it can be archived and reviewed until you replace it

### Examples

### Example 1: Architectural refactor

After extracting review orchestration into a pipeline across five files:

```json
{
  "version": "1.0",
  "generatedAt": "2026-05-05T12:00:00Z",
  "notes": [
    {
      "id": "pipeline-service",
      "file": "src/services/reviewPipeline.ts",
      "line": 18,
      "type": "info",
      "title": "Added review pipeline coordinator",
      "content": "Created a pipeline service that separates report loading, diff collection, note anchoring, and state assembly. This changed the architecture so review state can be tested without opening a webview. Trade-off: one more service boundary. Review the async error path. Validation: npm test.",
      "checked": false
    },
    {
      "id": "pipeline-types",
      "file": "src/types/reviewPipeline.ts",
      "line": 1,
      "type": "info",
      "title": "Added pipeline data contracts",
      "content": "Introduced typed inputs and outputs shared by parser, service, and webview layers. This documents why each stage exists and reduces ad hoc object shapes. Validation: npm test.",
      "checked": false
    },
    {
      "id": "pipeline-parser",
      "file": "src/services/reportParser.ts",
      "line": 44,
      "type": "warning",
      "title": "Parser now returns normalized notes",
      "content": "Moved note normalization into parsing so later pipeline stages receive consistent line and type data. This may change behavior for malformed reports, so review compatibility with old report files. Validation: npm test.",
      "checked": false
    },
    {
      "id": "pipeline-provider",
      "file": "src/webview/customEditorProvider.ts",
      "line": 92,
      "type": "info",
      "title": "Delegated state assembly to pipeline",
      "content": "The provider now calls the pipeline instead of combining report and diff data directly. This keeps the provider focused on VS Code webview lifecycle work. Validation: npm test.",
      "checked": false
    },
    {
      "id": "pipeline-renderer",
      "file": "media/scripts/src/render/notes.ts",
      "line": 27,
      "type": "suggestion",
      "title": "Renderer consumes anchored note metadata",
      "content": "Updated note rendering to use pipeline-produced anchor metadata. Consider adding a visual fallback for notes whose source line is no longer present. Validation: npm test.",
      "checked": false
    }
  ]
}
```

### Example 2: Medium logic change

After changing retry logic in a service:

```json
{
  "version": "1.0",
  "generatedAt": "2026-05-05T12:10:00Z",
  "notes": [
    {
      "id": "license-retry-backoff",
      "file": "src/services/licenseStoreService.ts",
      "line": 118,
      "type": "info",
      "title": "Changed license validation retry behavior",
      "content": "Replaced immediate retry with capped backoff so transient store failures do not create bursts of requests. Trade-off: failed validation can take slightly longer before falling back to cached status. Validation: npm test.",
      "checked": false
    },
    {
      "id": "license-retry-test",
      "file": "src/services/licenseStoreService.test.ts",
      "line": 132,
      "type": "info",
      "title": "Covered retry fallback behavior",
      "content": "Added tests for retry exhaustion and cached-status fallback so the new logic is reviewable and repeatable. Validation: npx vitest run src/services/licenseStoreService.test.ts.",
      "checked": false
    }
  ]
}
```

### Example 3: Small UI change

After tightening a webview interaction:

```json
{
  "version": "1.0",
  "generatedAt": "2026-05-05T12:20:00Z",
  "notes": [
    {
      "id": "note-filter-button-state",
      "file": "media/scripts/src/render/filterBar.ts",
      "line": 36,
      "type": "info",
      "title": "Clarified active filter button state",
      "content": "Updated the filter button rendering so selected note types expose aria-pressed and a stable active class. This is a small UI change, but it affects review navigation. Validation: npx vitest run media/scripts/src/render/filterBar.test.ts.",
      "checked": false
    },
    {
      "id": "note-filter-style",
      "file": "media/styles/main.css",
      "line": 214,
      "type": "suggestion",
      "title": "Adjusted active filter contrast",
      "content": "Increased active-state contrast without changing layout dimensions. Review in the webview for theme compatibility. Validation: npm test; visual verification was not run because this change only updates existing CSS tokens.",
      "checked": false
    }
  ]
}
```

### Example 4: Chore change

After ignoring generated output and removing a local artifact folder:

```json
{
  "version": "1.0",
  "generatedAt": "2026-05-05T12:30:00Z",
  "notes": [
    {
      "id": "ignore-test-results",
      "file": ".gitignore",
      "line": 6,
      "type": "info",
      "title": "Ignored Playwright test results",
      "content": "Added test-results/ so generated Playwright artifacts are not committed. This is a chore, but it changes repository hygiene and should be visible in review. Validation was not run because this only changes ignore rules.",
      "checked": false
    },
    {
      "id": "remove-test-results-folder",
      "file": "test-results/",
      "line": 1,
      "type": "info",
      "title": "Removed generated test-results folder",
      "content": "Deleted the existing test-results/ artifact directory because it contained generated output, not source. For deleted paths, the note is anchored to the path-level change. Validation was not run because no source code changed.",
      "checked": false
    }
  ]
}
```

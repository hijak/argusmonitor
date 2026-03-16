# Errors

## [ERR-20260315-001] exact-text-edit-miss

**Logged**: 2026-03-15T14:45:00Z
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
OpenClaw exact-text `edit` failed on `website/src/components/PricingSection.tsx` because the target snippet had already shifted after earlier replacements.

### Error
```
Edit in ~/clawd/projects/argusmonitor/website/src/components/PricingSection.tsx (23 chars) failed
```

### Context
- Operation attempted: exact text replacement in a rapidly changing file
- File had already been modified by multiple prior edits in the same turn
- Better fallback is to re-read the file and patch using current content, not stale snippets

### Suggested Fix
When a component is being edited multiple times in one task, re-read before additional exact replacements or rewrite the file section in one pass.

### Metadata
- Reproducible: yes
- Related Files: website/src/components/PricingSection.tsx

---

## [ERR-20260315-002] exact-text-edit-miss

**Logged**: 2026-03-15T22:57:30Z
**Priority**: low
**Status**: pending
**Area**: docs

### Summary
OpenClaw exact-text `edit` failed on `docs/docusaurus.config.ts` because the requested 120-character snippet did not match the current file content.

### Error
```
⚠️ 📝 Edit: in ~/clawd/projects/argusmonitor/docs/docusaurus.config.ts (120 chars) failed
```

### Context
- Operation attempted: exact text replacement in the Docusaurus config
- Current file is present and readable at `docs/docusaurus.config.ts`
- Repo status did not show a pending change for that file, suggesting the target text may already have changed or the edit was based on stale content

### Suggested Fix
Re-read `docs/docusaurus.config.ts` immediately before patching and apply the change against the current contents or rewrite the affected block in one pass.

### Metadata
- Reproducible: unknown
- Related Files: docs/docusaurus.config.ts
- See Also: ERR-20260315-001

---

## [ERR-20260316-001] wrong-build-root

**Logged**: 2026-03-16T08:09:30Z
**Priority**: low
**Status**: pending
**Area**: build

### Summary
A verification command tried to run `npm run build` from the repository root even though this repo has separate `frontend/` and `docs/` package roots.

### Error
```
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/Users/jack/clawd/projects/argusmonitor/package.json'
```

### Context
- Backend compile step passed
- Frontend and docs builds needed to be run from their own directories
- Follow-up verification succeeded after rerunning in `frontend/` and `docs/`

### Suggested Fix
Before running npm scripts, confirm the nearest `package.json` and execute from the correct subproject directory.

### Metadata
- Reproducible: yes
- Related Files: frontend/package.json, docs/package.json
- See Also: ERR-20260315-001, ERR-20260315-002

---

# Errors

## [ERR-20260330-003] paperclip-followup-issueid-truncation

**Logged**: 2026-03-30T14:15:30Z
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A Paperclip follow-up comment/close retry returned 500 because the issue ID in the mutating request path was accidentally truncated by one character.

### Error
```
POST /api/issues/0dc02c6b-dfa0-4119-888c-3ffdcffab1c/comments -> 500
PATCH /api/issues/0dc02c6b-dfa0-4119-888c-3ffdcffab1c -> 500
```

### Context
- Command/operation attempted: POST `/api/issues/{issueId}/comments`, PATCH `/api/issues/{issueId}`
- Repo/task context: Paperclip wake follow-up for Vordr issue `JAC-25`
- Cause: the retry script used a truncated issue UUID (`...ab1c` instead of `...ab1c4`) in the request path

### Suggested Fix
Copy the issue UUID directly from the wake payload or prior GET response before mutating calls, and log the exact path on retries when a 500 appears unexpectedly.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md
- See Also: ERR-20260330-001, ERR-20260330-002

### Resolution
- **Resolved**: 2026-03-30T14:15:30Z
- **Commit/PR**: local working tree
- **Notes**: Verified the typo, corrected the issue UUID, and retried the Paperclip follow-up flow against the documented endpoint.

---

## [ERR-20260330-002] paperclip-comment-close-env-payload

**Logged**: 2026-03-30T08:45:48Z
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A Paperclip issue comment POST and status PATCH were first attempted with Python serializers reading non-exported shell variables, causing the comment write to fail and the issue PATCH to send an incomplete payload.

### Error
```
KeyError: 'COMMENT'
KeyError: 'PATCH_COMMENT'
POST /api/issues/{issueId}/comments -> validation error (body required)
```

### Context
- Command/operation attempted: POST `/api/issues/{issueId}/comments`, PATCH `/api/issues/{issueId}`
- Repo/task context: Paperclip wake run for Vordr issue `JAC-8`
- Cause: shell heredoc variables were defined locally but not exported before Python read `os.environ[...]`

### Suggested Fix
For mutating Paperclip API calls, write JSON payloads directly to temp files (or export env vars explicitly) before invoking curl. Avoid relying on subprocess environment inheritance for multi-line comment bodies.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md
- See Also: ERR-20260330-001

### Resolution
- **Resolved**: 2026-03-30T08:45:48Z
- **Commit/PR**: local working tree
- **Notes**: Logged the failure pattern and retried using temp JSON files written directly by Python before the curl calls.

---

## [ERR-20260330-001] paperclip-comment-payload-shell-env

**Logged**: 2026-03-30T09:31:00Z
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A Paperclip issue comment POST failed because a shell variable used for JSON serialization was defined locally but not exported into the Python subprocess environment.

### Error
```
KeyError: 'COMMENT_BODY'
curl: (22) The requested URL returned error: 400
```

### Context
- Command/operation attempted: POST `/api/issues/{issueId}/comments`
- Repo/task context: Paperclip wake run for Vordr issue `JAC-4`
- Cause: Python serializer read `os.environ['COMMENT_BODY']`, but `COMMENT_BODY` was not exported from the shell before invocation

### Suggested Fix
When shelling out to Python for JSON payload generation, either `export` the variable first or write the payload to a temp file directly to avoid environment coupling.

### Metadata
- Reproducible: yes
- Related Files: strategy/release-packaging-pipeline.md, .learnings/ERRORS.md

### Resolution
- **Resolved**: 2026-03-30T09:32:00Z
- **Commit/PR**: local working tree
- **Notes**: Retried the Paperclip write flow using temp JSON files generated directly by Python, avoiding reliance on a non-exported environment variable.

---


## [ERR-20260320-005] host-detail-modal-duplicated-jsx-tail

**Logged**: 2026-03-20T21:59:00Z
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
A duplicated JSX tail was appended to `HostDetailModal.tsx` during the gauge component swap, breaking the Vite build.

### Error
```
[vite:esbuild] Transform failed with 1 error:
HostDetailModal.tsx:363:0: ERROR: Unexpected "}"
```

### Context
- Command attempted: `npm run build`
- File: `frontend/src/components/HostDetailModal.tsx`
- Cause: stale duplicated chart JSX remained after replacing `GaugeCard`

### Suggested Fix
Read the affected range and remove the duplicated tail instead of continuing surgical edits on a corrupted component tail.

### Metadata
- Reproducible: yes
- Related Files: frontend/src/components/HostDetailModal.tsx

### Resolution
- **Resolved**: 2026-03-20T21:59:00Z
- **Commit/PR**: local working tree
- **Notes**: Removed the duplicated JSX tail and resumed the build/deploy flow.

---

## [ERR-20260320-004] services-page-duplicated-jsx-tail

**Logged**: 2026-03-20T21:23:00Z
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
A duplicated JSX tail was appended to `ServicesPage.tsx` during service plugin UI edits, breaking the Vite build.

### Error
```
[vite:esbuild] Transform failed with 1 error:
ServicesPage.tsx:108:8: ERROR: Expected identifier but found "/"
```

### Context
- Command attempted: `npm run build`
- File: `frontend/src/pages/ServicesPage.tsx`
- Cause: stale duplicate JSX block appended after component end

### Suggested Fix
Rewrite the page cleanly after structural edits instead of patching repeated fragments into the tail.

### Metadata
- Reproducible: yes
- Related Files: frontend/src/pages/ServicesPage.tsx

### Resolution
- **Resolved**: 2026-03-20T21:23:00Z
- **Commit/PR**: local working tree
- **Notes**: Rewrote `ServicesPage.tsx` cleanly and resumed the frontend rebuild.

---

## [ERR-20260320-003] alembic-revision-id-too-long

**Logged**: 2026-03-20T16:36:00Z
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
Backend restart loop was caused by an Alembic revision ID exceeding the database column length for `alembic_version.version_num`.

### Error
```
sqlalchemy.exc.DataError: (psycopg2.errors.StringDataRightTruncation) value too long for type character varying(32)
[SQL: UPDATE alembic_version SET version_num='0008_host_enrollment_scope_revocation' ...]
```

### Context
- Command/operation attempted: backend startup migration / `alembic upgrade head`
- File: `backend/alembic/versions/0008_host_enrollment_scope_revocation.py`
- Cause: revision string exceeded the legacy varchar(32) column width in `alembic_version`

### Suggested Fix
Keep Alembic revision identifiers at or under 32 characters for this project.

### Metadata
- Reproducible: yes
- Related Files: backend/alembic/versions/0008_host_enrollment_scope_revocation.py

### Resolution
- **Resolved**: 2026-03-20T16:36:00Z
- **Commit/PR**: local working tree
- **Notes**: Shortened revision ID to `0008_host_enroll_scope` and rebuilt the backend.

---

## [ERR-20260320-002] infrastructure-onboarding-jsx-tail

**Logged**: 2026-03-20T16:34:00Z
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
A duplicated JSX tail was accidentally left at the end of `InfrastructurePage.tsx` during onboarding flow edits, breaking the Vite build.

### Error
```
[vite:esbuild] Transform failed with 1 error:
InfrastructurePage.tsx:744:9: ERROR: Expected identifier but found "/"
```

### Context
- Command attempted: `npm run build`
- File: `frontend/src/pages/InfrastructurePage.tsx`
- Cause: stale duplicated footer snippet (`ooter>`) appended after component end

### Suggested Fix
Remove the duplicate tail and rerun the frontend build before deployment.

### Metadata
- Reproducible: yes
- Related Files: frontend/src/pages/InfrastructurePage.tsx

### Resolution
- **Resolved**: 2026-03-20T16:34:00Z
- **Commit/PR**: local working tree
- **Notes**: Removed the duplicated tail and resumed the build/deploy flow.

---

## [ERR-20260320-001] filter-dropdown scroll patch syntax error

**Logged**: 2026-03-20T15:38:00Z
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
A quick edit to make `FilterDropdown` scrollable left duplicate JSX at the end of the file, breaking the frontend build.

### Error
```
[vite:esbuild] Transform failed with 1 error:
/app/src/components/ui/filter-dropdown.tsx:58:6: ERROR: Expected identifier but found "/"
```

### Context
- Command attempted: `docker compose up -d --build frontend`
- File: `frontend/src/components/ui/filter-dropdown.tsx`
- Cause: malformed manual patch after adding `ScrollArea`

### Suggested Fix
Replace the component file with a clean version, then rebuild and verify the namespace dropdown scrolls in KubernetesPage.

### Metadata
- Reproducible: yes
- Related Files: frontend/src/components/ui/filter-dropdown.tsx

### Resolution
- **Resolved**: 2026-03-20T15:41:00Z
- **Commit/PR**: local working tree
- **Notes**: Replaced the malformed file with a clean version, then later switched the long option filter from `DropdownMenu` to the shared `Select` primitive because wheel scrolling was still unreliable for the namespace picker.

---

## [ERR-20260315-001] exact-text-edit-miss

**Logged**: 2026-03-15T14:45:00Z
**Priority**: medium
**Status**: pending
**Area**: docs

### Summary
OpenClaw exact-text `edit` failed on `website/src/components/PricingSection.tsx` because the target snippet had already shifted after earlier replacements.

### Error
```
Edit in ~/clawd/projects/vordr/website/src/components/PricingSection.tsx (23 chars) failed
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
⚠️ 📝 Edit: in ~/clawd/projects/vordr/docs/docusaurus.config.ts (120 chars) failed
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
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/Users/jack/clawd/projects/vordr/package.json'
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

## [ERR-20260316-002] missing-local-alembic-cli

**Logged**: 2026-03-16T13:36:40Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
Attempted to autogenerate an Alembic migration from the host environment, but the local Python/Alembic CLI was not available even though the repo declares Alembic in backend requirements.

### Error
```
zsh:1: command not found: alembic
/Library/Developer/CommandLineTools/usr/bin/python3: No module named alembic.__main__; 'alembic' is a package and cannot be directly executed
```

### Context
- Operation attempted: generate migration for enterprise Phase 1 schema changes
- Repository has `backend/requirements.txt` with `alembic==1.14.1`
- Host execution environment did not have the backend virtualenv / installed Alembic CLI available
- Workaround used: hand-authored migration file under `backend/alembic/versions/`

### Suggested Fix
Standardize backend dev commands through a project venv, uv, or docker-compose service so Alembic generation runs from a known Python environment.

### Metadata
- Reproducible: yes
- Related Files: backend/requirements.txt, backend/alembic.ini, backend/alembic/versions/0001_enterprise_foundations.py
- See Also: ERR-20260316-001

---
## [ERR-20260317-001] docker-compose backend rebuild

**Logged**: 2026-03-17T06:59:00Z
**Priority**: high
**Status**: pending
**Area**: infra

### Summary
Backend container crashed after redeploy because `email-validator` was missing from Python requirements while Pydantic schemas used `EmailStr`.

### Error
```
ImportError: email-validator is not installed, run `pip install 'pydantic[email]'`
```

### Context
- Operation attempted: `docker compose up -d --build backend frontend`
- Environment: Vordr local Docker Compose deployment
- Trigger: backend app imports `EmailStr` in `backend/app/schemas.py`

### Suggested Fix
Add `email-validator` (or `pydantic[email]`) to `backend/requirements.txt` and rebuild the backend image before restart.

### Metadata
- Reproducible: yes
- Related Files: backend/requirements.txt, backend/app/schemas.py, backend/Dockerfile

---
## [ERR-20260317-002] sqlachemy workspace mapper wiring

**Logged**: 2026-03-17T07:13:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
Enterprise model changes introduced `back_populates` relationships on `Workspace` without matching relationship properties on child models, causing login and unrelated endpoints to 500 during mapper initialization.

### Error
```
sqlalchemy.exc.InvalidRequestError: Mapper 'Mapper[WorkspaceMembership(workspace_memberships)]' has no property 'workspace'
```

### Context
- Operation attempted: login with seeded admin account
- Impact: auth and other endpoints fail because SQLAlchemy mapper configuration fails at app runtime

### Suggested Fix
Ensure every `back_populates` declared on `Workspace` has a matching relationship on the child model (`WorkspaceMembership.workspace`, `OIDCProvider.workspace`, etc.) and smoke-test auth after model edits.

### Metadata
- Reproducible: yes
- Related Files: backend/app/models.py, backend/app/routers/auth.py

---
## [ERR-20260317-003] schema drift after model expansion

**Logged**: 2026-03-17T07:16:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
`User` model added `timezone` and `is_active` fields, but the live Postgres schema was never migrated, causing login queries to 500 with undefined column errors.

### Error
```
asyncpg.exceptions.UndefinedColumnError: column users.timezone does not exist
```

### Context
- Operation attempted: login with seeded admin account
- Alembic state was at `0002_stage2_stage3`, but no migration existed for the newer `users` columns.

### Suggested Fix
Add an Alembic migration whenever expanding ORM models, and smoke-test auth/login against the live DB after redeploy.

### Metadata
- Reproducible: yes
- Related Files: backend/app/models.py, backend/alembic/versions/0003_users_timezone_is_active.py

---
## [ERR-20260326-002] alembic_revision_id_too_long

**Logged**: 2026-03-26T16:11:12+00:00
**Priority**: high
**Status**: resolved
**Area**: backend

### Summary
Backend restart failed because the Alembic revision identifier exceeded the effective size of the `alembic_version.version_num` column.

### Error
```
sqlalchemy.exc.DataError: (psycopg2.errors.StringDataRightTruncation) value too long for type character varying(32)
[SQL: UPDATE alembic_version SET version_num='0017_service_classification_states' WHERE alembic_version.version_num = '0016_worker_job_dedupe_claiming']
```

### Context
- Operation attempted: rebuild/restart backend after adding service classification migration
- Migration file: `backend/alembic/versions/0017_service_classification_states.py`
- Environment: Docker Compose backend startup runs Alembic automatically

### Suggested Fix
Keep Alembic revision IDs short enough for the existing `alembic_version.version_num` storage, even when filenames are descriptive.

### Metadata
- Reproducible: yes
- Related Files: backend/alembic/versions/0017_service_classification_states.py

### Resolution
- **Resolved**: 2026-03-26T16:11:12+00:00
- **Notes**: Shortened revision id to `0017_service_classify` and restarted backend/worker.

---

## [ERR-20260326-003] agent_smoke_test_wrong_python_env

**Logged**: 2026-03-26T16:37:22+00:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
Agent runtime smoke test initially failed with `ModuleNotFoundError: No module named 'httpx'`, but the real problem was running the test outside the agent's dependency environment.

### Error
```
ModuleNotFoundError: No module named 'httpx'
```

### Context
- Operation attempted: `python3 - <<'PY' ... PluginManager().discover_services(...)`
- New built-ins added: Prometheus and Kubernetes, plus upgraded Docker collector
- Environment: `/Users/jack/clawd/projects/vordr/agent`
- `agent/requirements.txt` already includes `httpx==0.28.1`

### Suggested Fix
Run smoke tests inside the agent venv / built runtime instead of ambient workspace Python.

### Metadata
- Reproducible: yes
- Related Files: agent/requirements.txt, agent/vordr_agent/plugins/prometheus.py, agent/vordr_agent/plugins/kubernetes.py, agent/vordr_agent/plugins/docker_local.py

### Resolution
- **Resolved**: 2026-03-26T16:39:00+00:00
- **Notes**: Corrected diagnosis; requirements were already present.

---

## [ERR-20260326-004] python_literal_used_json_boolean

**Logged**: 2026-03-26T16:43:58+00:00
**Priority**: medium
**Status**: resolved
**Area**: backend

### Summary
Backend crashed on import because I pasted JSON-style `true` into a Python module instead of `True`.

### Error
```
NameError: name 'true' is not defined. Did you mean: 'True'?
```

### Context
- File: `backend/app/routers/services.py`
- Area: expanded discovery port fingerprints
- Effect: backend crash loop on startup

### Suggested Fix
When pasting structured literals into Python code, normalize JSON booleans/nulls (`true/false/null`) to Python (`True/False/None`) before rebuild.

### Resolution
- **Resolved**: 2026-03-26T16:43:58+00:00
- **Notes**: Replaced `true` with `True` and rebuilt backend/frontend.

---

## [ERR-20260327-001] cleanup_duplicate_services.py wrong interpreter

**Logged**: 2026-03-27T09:03:00Z
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
Duplicate cleanup script initially ran with a Python interpreter that did not have SQLAlchemy installed.

### Error
```
ModuleNotFoundError: No module named 'sqlalchemy'
```

### Context
- Command attempted from repo root with an incorrect relative venv path.
- Script requires the Vordr build venv / backend deps.

### Suggested Fix
Use `agent/.build-venv/bin/python` with `PYTHONPATH=backend` when running repo maintenance scripts that import backend models.

### Metadata
- Reproducible: yes
- Related Files: scripts/cleanup_duplicate_services.py
- Tags: python, venv, maintenance

### Resolution
- **Resolved**: 2026-03-27T09:04:00Z
- **Notes**: Re-ran using the correct build venv path and backend PYTHONPATH.

---
## [ERR-20260329-001] alerts-page-stale-bundle-fallback

**Logged**: 2026-03-29T02:04:30Z
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
Alerts page stayed broken after a frontend fix because the browser held an old hashed JS bundle, and nginx returned index.html with HTTP 200 for missing /assets/* paths instead of 404.

### Error
```
ReferenceError: visibleAlerts is not defined
from old bundle hash AlertsPage-DCho3UO6.js
```

### Context
- Frontend code was fixed and rebuilt to a new hashed asset.
- Live root HTML pointed at the new bundle.
- Old bundle URL still returned HTML due to SPA catch-all config.
- That made stale cached asset requests fail confusingly and look like the new deploy hadn't landed.

### Suggested Fix
- Keep /assets/* on try_files $uri =404 instead of SPA fallback.
- Only app routes should fall back to /index.html.
- When user reports the same frontend error after deploy, verify live bundle hash in root HTML versus error stack asset hash before assuming code fix failed.

### Metadata
- Reproducible: yes
- Related Files: frontend/nginx.conf, frontend/src/pages/AlertsPage.tsx

---


## [ERR-20260330-001] paperclip-comment-body-shell-env-miss

**Logged**: 2026-03-30T08:24:40+00:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
A Paperclip issue comment POST failed because a shell heredoc value was referenced via `os.environ` without being exported, resulting in an empty JSON body.

### Error
```
KeyError: 'COMMENT_BODY'
Validation error: body Required
```

### Context
- Command/operation attempted: `POST /api/issues/{issueId}/comments`
- Integration: local Paperclip API at `http://10.13.37.9:3100`
- Cause: `comment_body=$(cat <<EOF ...)` created a shell variable, but the Python subprocess tried to read `COMMENT_BODY` from the environment.
- Outcome: standalone comment POST failed, but `PATCH /api/issues/{issueId}` with `comment` still succeeded and created the completion comment.

### Suggested Fix
When building JSON via a Python subprocess, either `export COMMENT_BODY` first or pass the string directly to Python/stdin. For simple Paperclip completions, the `PATCH` `comment` field is sufficient and more robust.

### Metadata
- Reproducible: yes
- Related Files: strategy/edition-capability-model.md

---

## [ERR-20260330-001] exec-shell-quoting

**Logged**: 2026-03-30T09:22:15Z
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
Inline exec command failed because nested quoting in a zsh rg pattern produced an unmatched quote error

### Error
```
zsh:1: unmatched "
```

### Context
- Command/operation attempted: `git pull --rebase && rg ...` from OpenClaw exec
- Input or parameters used: single-line shell with nested quote escapes around an rg regex containing both single and double quotes
- Environment details if relevant: macOS zsh in `/Users/jack/clawd/projects/vordr`

### Suggested Fix
Prefer multiline shell scripts or Python helpers for regex-heavy search commands instead of deeply nested single-line quoting.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md

---
## [ERR-20260330-001] git-pull-rebase-dirty-worktree

**Logged**: 2026-03-30T13:59:44Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Repo hygiene rule says to pull before work, but git pull --rebase was blocked by an already-dirty worktree.

### Error
```
error: cannot pull with rebase: You have unstaged changes.
error: Please commit or stash them.
```

### Context
- Command attempted: `git -C /Users/jack/clawd/projects/vordr pull --rebase`
- The repository already contained many modified and untracked files from in-progress work.
- To avoid trampling user or prior-agent changes, the task was completed by reviewing existing docs in the current working tree instead of forcing a stash/reset.

### Suggested Fix
Before enforcing the pull-first rule in active repos, inspect `git status --short`. If the tree is already dirty, avoid pull/rebase until ownership of the local changes is clear, or use a dedicated clean worktree.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md
- See Also: none

---

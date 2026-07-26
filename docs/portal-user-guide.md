# OneMCP Portal — User Guide

> Version: Phase 3D (v1.5)
> Last updated: 2026-07-26

---

## Overview

OneMCP Portal is a Next.js 15 web application for creating, searching, and managing knowledge artifacts across departments. It connects to the OneMCP backend API.

**Main pages:**

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Activity widgets, quick links |
| Artifacts | `/artifacts` | Browse and filter all artifacts |
| Artifact detail | `/artifacts/[id]` | View, edit, history, attachments |
| New artifact | `/artifacts/new` | Template picker → form → editor |
| Search | `/search` | Hybrid / full-text / vector search |
| Skills | `/skills` | Browse and view skills |
| Profile | `/profile` | User identity and settings |
| API Keys | `/profile/api-keys` | Generate and manage personal API keys |
| Spaces admin | `/spaces` | Create and manage knowledge spaces (admin) |
| Onboarding | `/onboarding` | Department-specific getting-started guides |

<!-- TODO: screenshot — full navigation screenshot -->

---

## Space Switcher

The **Space Switcher** dropdown appears in the top navigation bar. Selecting a space filters artifacts and search results to that space.

- Selection is persisted in `localStorage` and reflected in the URL (`?space=<slug>`).
- Changing space re-fetches the current page's data automatically.
- Select **All spaces** to remove the space filter.

<!-- TODO: screenshot — space switcher dropdown -->

---

## Filter Panel

Most list pages (Artifacts, Search) include a collapsible **Filter panel** below the page header.

**Available filters:**

| Filter | Description |
|---|---|
| Space | Filter by knowledge space slug |
| Template | Filter by template type (kb, runbook, sop…) |
| Status | draft / pending / published / archived |
| Tags | Comma-separated tag list |
| Author | `me` or user ID |
| Date range | Created between two dates |

**URL deep-linking:** All filter state is synced to the URL query string. Share the URL to reproduce the exact filtered view.

**Reset:** Click **Reset filters** (appears when any filter is active) to clear all at once.

<!-- TODO: screenshot — filter panel expanded -->

---

## Search

URL: `/search`

<!-- TODO: screenshot — search page -->

### Search modes

Use the tab toggle at the top to choose a search mode:

| Mode | Description |
|---|---|
| **Hybrid** | Combines full-text + vector scoring (recommended) |
| **Full-text** | PostgreSQL `tsvector` full-text search |
| **Vector (semantic)** | Embedding-based similarity search |

### Running a search

1. Type your query in the search bar (minimum 2 characters).
2. Select a mode (default: Hybrid).
3. Optionally expand the filter panel to narrow by space, template, or tags.
4. Press **Search** or hit Enter.

Results show: title, kind badge, source mode badge, snippet with highlighted matches, tags.

### Saving a search

1. Run a search that returns results.
2. Click **Save search** (top-right, enabled after first results).
3. Enter a name in the dialog and click **Save**.
4. The saved search appears in the **Saved searches** strip below the nav bar.

---

## Saved Searches

Saved searches appear in a compact strip below the navigation bar.

- Click a saved search item to navigate to `/search` with the saved query and filters pre-applied.
- Hover any item to reveal the **delete** (trash) icon. Click it to confirm deletion.
- Loading state shows skeleton lines; empty state shows "No saved searches yet."

<!-- TODO: screenshot — saved searches strip with items -->

---

## Creating an Artifact

URL: `/artifacts/new`

<!-- TODO: screenshot — template picker step -->

**3-step flow:**

1. **Template picker** — Select a template card (kb, runbook, sop, etc.). Each card shows the template label and description.
2. **Form** — Fill in required and optional structured fields defined by the template schema.
3. **Editor** — Write the artifact body using the Markdown editor with live preview split-pane. Add tags (comma-separated).

Click **Submit for review** to save as `pending`. A toast confirms submission with a link to the artifact.

Draft state is auto-saved to `localStorage` — refreshing won't lose your work.

---

## Artifact Detail

URL: `/artifacts/[id]`

<!-- TODO: screenshot — artifact detail tabs -->

**Tabs:**

| Tab | Description |
|---|---|
| View | Rendered markdown content |
| Edit | In-place markdown editor |
| History | Version list with side-by-side diff viewer |
| Attachments | Upload and download file attachments |

**Version diff:** Click any two versions in History to see a side-by-side diff of the artifact body.

---

## API Key Generation

URL: `/profile/api-keys`

<!-- TODO: screenshot — API keys list -->

Use API keys to authenticate programmatic access to the OneMCP API.

### Generating a key

1. Click **Generate key**.
2. Enter a label (required) and expiry in days (default: 90, max: 365).
3. Click **Generate**.
4. **Copy the full key immediately** — it is shown exactly once. The dialog will not close until you click the copy button and confirm.

**Security best practices:**
- Store the key in a secrets manager (e.g. Vault, GitHub Actions secrets).
- Never commit a key to source control.
- Set a short expiry (≤90 days) for CI/CD keys; rotate regularly.
- Revoke compromised keys immediately.

### Revoking a key

Click **Revoke** on any key row. Confirm in the dialog. The key is invalidated immediately — any service using it will lose access.

List columns: Label, Prefix (first 8 chars), Last used, Expires, Status (active/expired).

---

## Spaces Admin

URL: `/spaces`

> **Admin only.** This page returns a 403 error for non-admin users.

<!-- TODO: screenshot — spaces list table -->

### Creating a space

1. Click **New space**.
2. Fill in Name (required), Slug (required, auto-derived from name), Description (optional), Visibility.
3. Click **Create**.

Slugs cannot be changed after creation.

### Editing a space

Click **Edit** on any row to open `/spaces/[id]`. Update name, description, or visibility. The slug field is read-only.

### Deleting a space

Click **Delete** on any row. Confirm in the dialog. **Artifacts in the space are NOT deleted** — only the space metadata is removed.

---

## Onboarding

URL: `/onboarding`

<!-- TODO: screenshot — dept picker cards -->

Click your department card to open a tailored getting-started guide:

| Department | URL |
|---|---|
| Engineering / Tech | `/onboarding/tech` |
| Operations | `/onboarding/ops` |
| Customer Support | `/onboarding/support` |

Each guide contains:
- Overview of relevant artifact templates
- Quick links to filtered artifact views
- Step-by-step getting-started instructions
- Recommended template table

> Phase 4 will replace static guide content with DB-backed seed documents.

---

## URL Deep-Linking Reference

| Parameter | Pages | Example |
|---|---|---|
| `?q=` | Search | `?q=payment+timeout` |
| `?mode=` | Search | `?mode=fts` |
| `?space=` | Search, Artifacts | `?space=engineering-kb` |
| `?template_key=` | Search, Artifacts | `?template_key=runbook` |
| `?tags=` | Search, Artifacts | `?tags=k8s,ops` |
| `?status=` | Artifacts | `?status=published` |
| `?author=` | Artifacts | `?author=me` |
| `?date_from=` | Artifacts | `?date_from=2026-01-01` |
| `?date_to=` | Artifacts | `?date_to=2026-06-30` |

All filter parameters can be combined. The URL fully represents the page state and can be bookmarked or shared.

---

## Dark Mode

The portal supports dark mode via the system preference or manual toggle (if theme switcher is enabled in layout). All components use Tailwind `dark:` variants — no custom CSS overrides.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Search returns no results | Mode mismatch or embeddings not indexed | Try switching from Vector to Full-text mode |
| 403 on `/spaces` | Not an admin user | Contact your OneMCP administrator |
| API key list empty | No keys generated yet | Click Generate key |
| Artifact stuck in pending | No reviewer assigned | Ask a reviewer to approve in `/artifacts/review` |
| Save search button disabled | No results yet | Run a search first |

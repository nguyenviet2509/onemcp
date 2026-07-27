# Design Consistency Guardrails — OneMCP Portal

> Last updated: 2026-07-27 (Phase 3D-ui plan)
> Enforced by: code review + grep audit each PR

---

## 1. Icon Budget — STRICTLY ≤5 site-wide

**Rule:** Only `sidebar-nav.tsx` may import from `lucide-react`. Zero icon imports anywhere else.

**Allowed icons (5 total):**

| Icon | Route |
|---|---|
| `LayoutDashboard` | `/` Dashboard |
| `FileText` | `/artifacts` Artifacts |
| `Search` | `/search` Search |
| `Sparkles` | `/skills` Skills |
| `ClipboardCheck` | `/artifacts/review` Review queue |

**Verification (run in CI or before PR merge):**
```bash
grep -r "from 'lucide-react'" portal/ --include="*.tsx"
# Expected: exactly 1 match — portal/components/sidebar-nav.tsx
```

**Why:** Icon proliferation → visual noise, inconsistent emphasis, harder scanning.

---

## 2. Semantic Pill Palette — Always use `Badge` variants

**Rule:** Never use ad-hoc `className` color strings for status/type labels. Always use the `Badge` component from `components/ui/badge.tsx` with the semantic variant.

**Allowed variants for status:**

| Status | Variant prop |
|---|---|
| `published` | `status-published` |
| `pending` | `status-rejected` |
| `rejected` | `status-rejected` |
| `archived` | `status-archived` |

**For type/template labels:** use `variant="template"` (slate outline).
**For tags:** use `variant="tag"`.

**Helper:** `import { statusVariant } from '@/lib/status-pill-variants'` — maps `ArtifactStatus` → variant string.

**Verification:**
```bash
grep -r "STATUS_CLASS\|STATUS_CLASSES\|bg-amber-\|bg-green-\|bg-red-" portal/app portal/components --include="*.tsx"
# Expected: 0 matches (all replaced by Badge variants)
```

---

## 3. Component Primitives Allowlist

Only use these UI primitives — do NOT create ad-hoc equivalents:

| Purpose | Component | Path |
|---|---|---|
| Badge / pill | `Badge` | `@/components/ui/badge` |
| Button | `Button`, `buttonVariants` | `@/components/ui/button` |
| Card | `Card`, `CardHeader`, `CardTitle`, `CardContent` | `@/components/ui/card` |
| Input | `Input` | `@/components/ui/input` |
| Skeleton | `Skeleton` | `@/components/ui/skeleton` |
| Alert | `Alert`, `AlertDescription`, `AlertTitle` | `@/components/ui/alert` |
| Dialog | `Dialog`, `DialogContent`, … | `@/components/ui/dialog` |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` |
| Separator | `Separator` | `@/components/ui/separator` |
| Dropdown | `DropdownMenu`, … | `@/components/ui/dropdown-menu` |
| Checkbox | `Checkbox` | `@/components/ui/checkbox` |
| Label | `Label` | `@/components/ui/label` |
| Empty state | `EmptyState` | `@/components/empty-state` |
| Page layout | `PageShell` | `@/components/page-shell` |
| Root layout | `AppShell` | `@/components/app-shell` |
| Error state | `WidgetError` | `@/components/widget-error` |

Do NOT introduce additional icon libraries, animation libraries, or chart libraries without explicit approval.

---

## 4. Tailwind Token Rules

**Rule:** Only Tailwind utility classes + CSS vars from `globals.css`. No inline `style={{color: '...', background: '...'}}`.

**Dark palette reference:**

| Token | Usage |
|---|---|
| `bg-slate-950` | Root page background |
| `bg-slate-900` | Sidebar background |
| `bg-slate-800` | Interactive sidebar elements |
| `border-slate-800` | Sidebar/card borders |
| `text-slate-100` | Primary text (dark mode) |
| `text-slate-400` | Secondary text |
| `text-slate-500` | Muted / labels |

**Verification:**
```bash
grep -r 'style={{' portal/app portal/components --include="*.tsx" | grep -E 'color|background|border'
# Expected: 0 matches
```

---

## 5. File Size Limit

Individual component/page files must stay under 200 lines. Split into subcomponents when approaching limit. Use kebab-case file names.

---

## 6. Server vs Client Component Boundary

- `AppShell` — server component (imports client children)
- `SidebarBrand`, `SidebarNav`, `SidebarSecondaryNav` — client (use `usePathname`, `useEffect`)
- `SpaceSwitcher`, `SavedSearchesList` — client (use state, router)
- Page shells (`PageShell`) — server component
- Data-fetching widgets — client (use `useEffect` + API client)

**Rule:** Mark `'use client'` only when the component uses browser APIs, hooks, or event handlers. Keep server components server-side to reduce bundle size.

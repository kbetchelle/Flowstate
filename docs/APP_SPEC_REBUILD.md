# Flowstate — App specification for rebuild

This document describes how the app works and what is **in scope** vs **out of scope** for a from-scratch rebuild. Use it as the single source of truth when restarting the app.

---

## 1. Overview

- **App name:** Flowstate (product name in UI and docs).
- **Architecture:** Single-page app; no URL routing for views (view state only).
- **Auth:** Supabase (email/password, PKCE, custom storage for "stay logged in").
- **Platform:** Desktop first; mobile supported with FAB + bottom nav (mobile scope may be expanded or limited later).
- **PWA:** Installable, service worker (keep).

---

## 2. Command palette (one menu)

**The command palette and the backslash menu are the same thing.** One menu, two ways to open it:

- **Open from anywhere:** Cmd+K (Mac) or Ctrl+P (Windows/Linux).
- **Open in context:** Type `\` when focus is in the list or in an editor (e.g. task title/description); the same menu opens.

This menu is the **primary tool** for creation, editing, navigation, view switching, and quick actions (Notion-style). There is no separate "backslash menu" — just one palette.

**Creation flow:** Command-palette–only. "New task" or "New directory" are top-level palette commands; selecting one creates an inline row or minimal form (no modal). User continues typing after Enter to name the new object inline.

**View switching in palette:** "Switch to List/Calendar/Kanban" and "Main / Upcoming / Archive" are palette commands only (no Cmd+Shift+1/2/3). No "Go to [directory]" or "Go to parent" in palette.

**Dependency Graph:** Open via command palette; may open in a temporary column of its own or as part of the full task editing panel that expands when a task has dependencies.

---

## 3. Views and navigation

**Views in scope:** Main, Upcoming, Archive, Settings.

**Out of scope:** Saved views (Cmd+2…9); save current view (Cmd+Alt+S).

**View types per directory:** List, Calendar, Kanban — all three kept; accessible **via command palette only** (no dedicated shortcuts).

**Sidebar:** Removed. **Replacement (Q31):** Breadcrumbs only in main content for now; later add top nav/tabs so users can click between open views or open places within their task/directory lists.

**Columns:** Keep the current **multiple-column (drill-down)** model. Scroll column left/right (Cmd+Shift+Arrow) and Home/End (first/last column) are kept. (Note: "End" — theoretically there is no end; document or simplify in implementation as needed.)

**Header:** Search, Settings, and Help are reachable by **arrow keys** (and Tab). Specify which key focuses the first header control in implementation.

---

## 4. Data model

**Entities:** Tasks, directories (nested), task links (dependencies/references).

**Task fields in scope:** title, directory_id, priority (LOW|MED|HIGH), start_date, due_date, background_color, category, tags, description, is_completed, completed_at, status (not_started | in_progress | finishing_touches | completed), archived_at, archive_reason, position, recurrence fields, checklist_items, estimated_duration_minutes, actual_duration_minutes, url, version (conflict resolution).

**Out of scope:** Time tracking (timer, time_entries) — remove.

**Conflict resolution:** Keep. Version field on tasks/directories; merge/choose version via ConflictDialog (choose version, not last-write-wins).

**Auto-archive (Q55):** Show completed tasks in main home for **5 days**, then move to archive.

---

## 5. Keyboard shortcuts

`mod` = Cmd (Mac) / Ctrl (Windows/Linux). **Palette only** = action exists only via command palette (no dedicated key).

### Global — in scope

| ID | Keys | Alt keys | Label |
|----|------|----------|--------|
| view.main | mod+1 | — | Main view |
| view.upcoming | mod+shift+l | — | Upcoming view |
| view.archive | mod+shift+a | — | View archived tasks |
| command.palette | mod+k | ctrl+p | Open command palette |
| search.open | mod+shift+s | — | Open search overlay |
| view.completedToggle | mod+shift+h | — | Show/hide completed tasks |
| view.shortcutSheet | mod+/ | — | Show keyboard shortcuts |
| settings.open | mod+, | — | Open settings |
| action.undo | mod+z | — | Undo |
| action.redo | mod+shift+z | — | Redo |
| view.scrollLeft | mod+shift+arrowleft | — | Scroll column left |
| view.scrollRight | mod+shift+arrowright | — | Scroll column right |
| view.scrollHome | home | — | First column |
| view.scrollEnd | end | — | Last column |
| color.none | mod+alt+n | — | Color: none |
| color.category | mod+alt+c | — | Color: category |
| color.priority | mod+alt+p | — | Color: priority |

### Global — palette only (no dedicated key)

- Switch to List view  
- Switch to Calendar view  
- Switch to Kanban view  
- Create (task or directory)  
- Create directory  

### Global — removed

- view.save (mod+alt+s)  
- view.savedView2…9 (mod+2 … mod+9)  

### Contextual: Navigation — in scope

| ID | Keys | Alt keys | Label |
|----|------|----------|--------|
| nav.up | arrowup | — | Move focus up |
| nav.down | arrowdown | — | Move focus down |
| nav.left | arrowleft | — | Collapse column |
| nav.right | arrowright | — | Expand / open |
| nav.enter | enter | — | Expand / open |
| nav.escape | escape | — | Clear selection |
| nav.space | (space) | — | Toggle completion |
| select.up | shift+arrowup | — | Extend selection up |
| select.down | shift+arrowdown | — | Extend selection down |
| select.all | mod+a | — | Select all in column |
| nav.first | mod+arrowup | — | First item in column |
| nav.last | mod+arrowdown | — | Last item in column |
| edit.full | mod+shift+e | — | Full edit (panel) |
| task.delete | mod+delete | mod+backspace | Delete selected |
| clipboard.copy | mod+c | — | Copy |
| clipboard.copyRecursive | mod+shift+c | — | Copy recursive |
| clipboard.paste | mod+v | — | Paste (always with metadata) |
| clipboard.cut | mod+x | — | Cut |
| menu.backslash | \ | — | Open command palette |

### Contextual: removed

- edit.quick (alt+e) — default is quick edit; no separate shortcut.  
- clipboard.pasteWithMetadata (mod+shift+v) — one paste action that always uses metadata.  

### Contextual: Creation, Editing, Search, Settings, Confirmation, Grab — in scope

- creation.task (t), creation.directory (d), creation.cancel (escape)  
- edit.close (escape), edit.attachment (mod+shift+f)  
- search.close, settings.save, settings.close, confirm.yes, confirm.cancel  
- grab.activate (ctrl+space then g) and grab.* in grab context  

### Contextual: removed

- edit.openAttachments (mod+shift+o)  
- Sidebar shortcuts (sidebar removed)  

**Shortcut remapping:** Keep; actions in REMAPPABLE_ACTIONS can be remapped in Settings.

---

## 6. Inline creation and list entry (Q40, Q41)

**Inline creation (t/d):** Yes. When in a dedicated creation context, `t` = new task, `d` = new directory. Formatting for multi-item entry:

- **One idea per line** — Each line break creates a new item. No list structure, no bullets, no special formatting. Raw text separated by newlines; text wraps.
- **Free-form entry** — User types, hits Enter/Return for a new line. No per-item add/delete buttons.
- **Scrollable container** — When content exceeds the visible area, it scrolls. Left-aligned.

**Random Decision Maker–style (NOTE C):** This behavior is the **main way to add multiple tasks in one column** — each line = task. Arrows keep cursor in text (no jump to start/end of row).

---

## 7. Features in scope

- Command palette (Cmd+K or `\`) — one menu, primary UI.  
- Search overlay — keyboard-reachable from header (arrow keys).  
- Main view, Upcoming view, Archive view, Settings view.  
- List / Calendar / Kanban (via command palette only).  
- Columns navigation; arrow + Enter/Space nav.  
- Shift+arrow / Cmd+A selection; copy / cut / paste (paste always with metadata); copy recursive.  
- Quick edit (inline) as default; full edit (metadata panel).  
- Delete selected; undo/redo.  
- Conflict resolution (version, choose version/merge).  
- Offline support; connection indicator; offline banner.  
- Theme (light/dark/system + accent).  
- Creation: palette-only (inline row or minimal form); inline creation (t/d) in creation context.  
- Grab mode; drag and drop (drag handle dots only when mouse used or hovering over dots).  
- Task links / Dependency Graph (open via palette).  
- Recurrence (full pattern: frequency, interval, end date).  
- Checklist on tasks (and completed-task behavior).  
- Task status; attachments (panel only); task URL field.  
- Color mode (none/category/priority); show/hide completed.  
- Shortcut sheet (Cmd+/); Help sheet (Q44: keep both or merge — TBD in implementation).  
- Onboarding flow (keep).  
- Mobile: FAB, bottom nav (Main and Search for now).  
- PWA.  
- Auto-archive: completed tasks in main for 5 days, then archive.  

---

## 8. Features out of scope

- Saved views (Cmd+2…9); save current view.  
- Sidebar tree (replaced by breadcrumbs, then top nav/tabs).  
- Time tracking (timer, time_entries).  
- Mobile multi-select toolbar.  
- Creation modal (creation is palette → inline only).  
- edit.quick (Alt+E) as separate shortcut.  
- Paste with metadata as separate action (single paste = with metadata).  
- edit.openAttachments (Cmd+Shift+O).  
- "Go to [directory]" / "Go to parent" in palette.  

---

## 9. UI and layout

- **Top bar:** Title (Flowstate), connection indicator; Search, Settings, Help (focus via Tab and arrow keys).  
- **No sidebar.** Main content uses breadcrumbs (and later top nav/tabs).  
- **Main content:** Column-based drill-down; list/calendar/kanban per directory.  
- **Modals/overlays:** ConflictDialog; ShortcutSheet; HelpSheet; Command palette; Search overlay; OnboardingFlow; FeedbackToast. No CreationModal.  
- **Mobile:** FAB (single "New" — use command palette to choose add task or add directory, then name inline); bottom nav (Main, Search for now).  
- **Full edit panel:** Keep (all fields, attachments, checklist). Attachments and task URL in panel only.  

---

## 10. Backend and auth

- **Supabase:** Auth + database; RLS; realtime subscriptions.  
- **Offline:** Cache; sync when back; conflict resolution on reconnect.  
- **PWA:** Installable; service worker.  

---

## 11. Answers reference (Q31–Q58)

| Q | Answer |
|---|--------|
| Q31 | Breadcrumbs for now; later top nav/tabs for open views and places. |
| Q32 | Header: arrow keys (and Tab). |
| Q33 | Keep multiple-column (drill-down). |
| Q34 | Keep scroll column left/right. |
| Q35 | Keep Home/End (note: "End" — no theoretical end; document in impl). |
| Q36 | Command-palette–only creation (inline row or minimal form, no modal). |
| Q37 | "New task" / "New directory" as top-level palette commands. |
| Q38 | View switching (List/Calendar/Kanban, Main/Upcoming/Archive) palette only. |
| Q39 | No "Go to [directory]" / "Go to parent" in palette. |
| Q40 | Inline creation (t/d) with one idea per line, free-form, scrollable, left-aligned. |
| Q41 | Random Decision Maker–style = main way to add multiple tasks (each line = task). |
| Q42 | Keep all three color modes. |
| Q43 | Keep show/hide completed toggle. |
| Q44 | Shortcut sheet vs Help: keep both or merge — TBD. |
| Q45–Q47 | Keep copy recursive, multi-select, grab mode. |
| Q48 | Full edit panel. |
| Q49 | Attachments: panel only. |
| Q50 | Keep task URL field. |
| Q51 | Bottom nav: Main and Search for now. |
| Q52 | FAB: mirror desktop — command palette to add task/directory, then name inline. |
| Q53 | Keep onboarding. |
| Q54 | Conflict UI: choose version (keep ConflictDialog). |
| Q55 | Auto-archive: show completed in main 5 days, then archive. |
| Q56 | Dependency Graph: command palette; may open in temp column or in task panel. |
| Q57 | App name: Flowstate. |
| Q58 | Recurrence: full pattern. |

---

*Use this document as the single source of truth when rebuilding the app from scratch.*

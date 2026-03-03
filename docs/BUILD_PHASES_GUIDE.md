# Flowstate rebuild — Build phases guide

**Purpose:** This guide breaks the Flowstate rebuild into ordered phases so Cursor (or any implementer) can build the app from scratch with clear scope per phase.

**Reference:** Every phase must align with **[APP_SPEC_REBUILD.md](APP_SPEC_REBUILD.md)**. Treat that document as the single source of truth for in-scope vs out-of-scope, keyboard shortcuts, data model, and UX decisions. When in doubt, check the spec.

**How to use:** Implement phases in order. Each phase lists spec sections to follow, what to build, what to skip, and a short "Done when" checklist. Do not add features that the spec marks as out of scope (e.g. saved views, sidebar, time tracking, CreationModal, "Go to directory" in palette).

---

## Phase 0: Project bootstrap and reference

**Goal:** New or cleaned repo with tooling, env, and the spec as the canonical reference.

**Spec reference:** §1 Overview, §10 Backend and auth.

**Implement:**
- React + TypeScript app (Vite or existing bundler).
- Dependencies: react, react-dom, zustand, @supabase/supabase-js, @tanstack/react-query (or equivalent), routing only if needed for auth callback (e.g. `?code=`); no react-router for in-app views.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- App entry: bootstrap that can handle OAuth callback (e.g. `exchangeCodeForSession`), then render app or login.
- Ensure **[APP_SPEC_REBUILD.md](APP_SPEC_REBUILD.md)** is in `docs/` and linked from this guide.
- README or CONTRIBUTING note: "Rebuild scope is defined in docs/APP_SPEC_REBUILD.md; implementation order in docs/BUILD_PHASES_GUIDE.md."

**Do not:** Add sidebar, saved views, time tracking, or CreationModal.

**Done when:** App runs (blank or login screen), env loads Supabase, and spec is the stated reference for scope.

---

## Phase 1: Backend and data layer

**Goal:** Supabase schema and TypeScript types that match the spec; no time tracking.

**Spec reference:** §4 Data model, §8 Features out of scope, §10 Backend and auth.

**Implement:**
- **Tables:** `directories` (id, name, parent_id, position, depth_level, user_id, version, timestamps), `tasks` (all fields in spec §4: title, directory_id, priority, start_date, due_date, background_color, category, tags, description, is_completed, completed_at, status, archived_at, archive_reason, position, recurrence fields, checklist_items, estimated_duration_minutes, actual_duration_minutes, url, version, user_id, timestamps), `task_links` (source_id, target_id, link_type, user_id), `user_settings` (user_id, theme, accent, custom_shortcuts, etc.), `action_history` for undo. Storage bucket for task attachments if needed.
- **RLS:** Policies so each user sees only their directories, tasks, task_links, settings, action_history.
- **Types:** TypeScript types/interfaces for Task, Directory, TaskLink, UserSettings, FilterState, CurrentView (main_db | upcoming | archive | settings). Status = not_started | in_progress | finishing_touches | completed.
- **Migrations:** Versioned migrations; include `version` on tasks and directories for conflict resolution.

**Do not:** Tables or columns for time_entries / timer; saved_views; sidebar-specific tables.

**Done when:** Migrations apply cleanly, RLS restricts by user_id, and types match spec §4.

---

## Phase 2: Auth and app shell

**Goal:** Login, session, and a minimal shell with top bar and main area; no sidebar; view state only.

**Spec reference:** §1 Overview, §3 Views and navigation, §9 UI and layout.

**Implement:**
- **Auth:** Supabase auth (email/password, PKCE). Login/signup screen; bootstrap: on load, handle `?code=` with `exchangeCodeForSession` if present, then `getSession`. Redirect or show app when session exists.
- **App shell:** Single layout: top bar + main content area. No sidebar.
- **Top bar:** App title "Flowstate", connection indicator (placeholder ok), and three controls: Search, Settings, Help. Make them focusable and reachable by Tab; in a later phase add arrow-key focus between them (spec §3 Q32).
- **View state:** `currentView`: main_db | upcoming | archive | settings. No URL for these; state only. Render a placeholder main area that switches on `currentView` (e.g. "Main", "Upcoming", "Archive", "Settings").
- **Store:** Minimal app store (e.g. currentView, setCurrentView, user/session from auth).

**Do not:** Sidebar, tabs for views in URL, saved views.

**Done when:** User can log in, see "Flowstate" and Search/Settings/Help, and switch currentView (e.g. via dev buttons or Cmd+1 / Cmd+Shift+L / Cmd+Shift+A / Cmd+,) so placeholder content changes.

---

## Phase 3: Core state and API

**Goal:** Zustand stores and API functions for tasks, directories, links, search, conflict resolution, settings, action history.

**Spec reference:** §4 Data model, §7 Features in scope, §8 Features out of scope, §10.

**Implement:**
- **Stores (Zustand):** appStore (currentView, navigationPath, selectedItems, focus state, filters, etc.), uiStore (creation state, edit panel state, drag state), taskStore, directoryStore, linkStore, authStore, conflictStore, settingsStore, networkStore (isOnline for offline), themeStore, feedbackStore (toasts). Optional: viewStore for list/calendar/kanban per directory. No saved-view or time-tracker store.
- **API modules:** `tasks` (fetch, insert, update, delete, archive, unarchive, updateWithConflictCheck), `directories` (fetch, CRUD, conflict check), `links` (fetch for user/task, create, delete), `search` (search tasks by filters), `conflictResolution` (findConflictingFields, attemptAutoResolve, resolve with version), `userSettings` (fetch, upsert), `actionHistory` (load, insert for undo). Attachments API if needed for panel.
- **Realtime:** Subscribe to tasks/directories changes for current user if desired.
- **Paste behavior:** Single "paste" that always applies metadata (no separate "paste with metadata" action); spec §5, §8.

**Do not:** Time tracking API; saved views read/write; sidebar state.

**Done when:** All in-scope entities are fetchable and updatable via API; conflict resolution uses version; undo uses action_history; one paste behavior is defined.

---

## Phase 4: Main content and column navigation

**Goal:** Breadcrumbs, column-based drill-down, and keyboard navigation in the main area.

**Spec reference:** §3 Views and navigation, §5 Keyboard shortcuts (contextual nav), §9 UI and layout.

**Implement:**
- **Breadcrumbs:** Show current navigation path (e.g. Root > Folder A > Folder B) in main content. No sidebar; no "Go to directory" in palette yet (spec says no).
- **Column layout:** Multiple columns: each column shows children of the selected directory or tasks in the selected directory. Drill down: select directory → next column shows its children/tasks. Left = back, right = deeper.
- **Navigation path:** State like `navigationPath: string[]` (directory ids) or equivalent; derive visible columns from it.
- **Keyboard (navigation context):** Arrow Up/Down (move focus), Left (collapse column / back), Right / Enter (expand / open), Space (toggle completion), Escape (clear selection). Shift+Arrow Up/Down (extend selection), Cmd+A (select all in column), Cmd+Arrow Up/Down (first/last item). Cmd+Shift+Arrow Left/Right (scroll column), Home/End (first/last column). See spec §5 tables.
- **Focus management:** Track focused item and column; restore focus when switching columns or views. No jump to start/end of row when moving with arrows in list entry (spec §6).
- **View type:** One view type per directory (list, calendar, or kanban). Default to list; switching only via command palette (Phase 5).

**Do not:** Sidebar; saved views; Cmd+Shift+1/2/3 for view type (palette only).

**Done when:** User can navigate folders and tasks in columns with keyboard only; breadcrumbs reflect path; scroll and Home/End work; selection (shift+arrow, Cmd+A) works in one column.

---

## Phase 5: Command palette (single menu)

**Goal:** One command palette opened by Cmd+K or `\`; primary for creation and view switching.

**Spec reference:** §2 Command palette, §5 Keyboard shortcuts, §7–§8.

**Implement:**
- **Trigger:** Cmd+K (and Ctrl+P) from anywhere; `\` when focus is in list or in an editor (task title/description). Same menu component for both.
- **UI:** Overlay with filter input; list of commands; arrow keys to move, Enter to run. Escape to close.
- **Commands (top-level):** "New task", "New directory", "Switch to List view", "Switch to Calendar view", "Switch to Kanban view", "Main view", "Upcoming view", "Archive view", "Open Dependency Graph" (phase 13). Do **not** add "Go to [directory]" or "Go to parent" (spec §2).
- **Creation flow:** On "New task" or "New directory", close palette and create an inline row (or minimal inline form); focus that row so user can type the name immediately. No modal (spec §2, §8).
- **View switching:** Changing view type (list/calendar/kanban) or main/upcoming/archive is only via this palette (no Cmd+Shift+1/2/3, no Cmd+2…9). Spec §3, §5.
- **Shortcut remapping:** If settings store has custom_shortcuts, palette can show user's key for an action; actual remapping is wired in Phase 12.

**Do not:** Separate "backslash menu" component; CreationModal; "Go to folder" / "Go to parent" in palette.

**Done when:** Cmd+K and `\` open the same palette; user can run New task/directory (and focus inline row), switch views and view types only from palette; Dependency Graph command exists (can open placeholder in Phase 13).

---

## Phase 6: Tasks and inline creation (including multi-line entry)

**Goal:** Task list items, inline creation with t/d, and multi-line entry where each line is a task (Random Decision Maker–style).

**Spec reference:** §6 Inline creation and list entry, §7 Features in scope, §8 (no Alt+E shortcut).

**Implement:**
- **Task list items:** Render tasks in the current column with title, completion toggle, and support for focus/selection. Default: clicking or focusing a task allows quick edit (inline rename) without a separate shortcut (spec: no Alt+E).
- **Creation context:** When focus is in a dedicated "creation" row or empty area, `t` = new task, `d` = new directory; Escape cancels.
- **Inline creation after palette:** After user chooses "New task" or "New directory" from palette, create the item and focus the inline row for naming.
- **Multi-line entry (one line = one task):** In the appropriate context (e.g. one column or one creation block), support: one idea per line; Enter = new line = new item (task); no bullets or list UI; free-form text, scrollable container; left-aligned. Arrow keys move cursor within text without jumping to start/end of the target line (spec §6, Q40–Q41).
- **Persistence:** Creating tasks/directories via palette or t/d calls API and updates stores; new items appear in the right column.

**Do not:** CreationModal; per-item add/delete buttons in the list; Alt+E as a separate shortcut.

**Done when:** User can add tasks/directories from palette (then type name inline) and with t/d in creation context; multi-line entry creates one task per line with correct cursor behavior.

---

## Phase 7: Full edit panel and task detail

**Goal:** Full task panel (all fields); open with Cmd+Shift+E; attachments and URL only in panel.

**Spec reference:** §5 (edit.full, edit.close, edit.attachment), §7, §9 UI and layout.

**Implement:**
- **Panel:** Slide-out or overlay panel for "full edit" of the focused/selected task. Contains: title, due date, start date, priority, status, description, checklist, recurrence, attachments, url, etc. (spec §4 task fields). No separate "quick edit" shortcut (quick edit is default inline behavior).
- **Open/close:** Cmd+Shift+E opens panel for selected task; Escape closes. edit.close (Escape) in editing context.
- **Attachments:** Add attachment in panel only (Cmd+Shift+F in panel context); no "Add attachment" in command palette (spec §7 Q49). No Cmd+Shift+O (open attachments) — removed per spec §5.
- **Task URL field:** Keep (spec Q50). Editable in panel.
- **Conflict:** When saving, use updateWithConflictCheck; if conflict, show ConflictDialog (Phase 10).

**Do not:** Separate "paste with metadata" shortcut; edit.openAttachments (Cmd+Shift+O); attachments from command palette.

**Done when:** User can open full panel with Cmd+Shift+E, edit all fields including checklist and recurrence, add attachments and URL in panel, and close with Escape.

---

## Phase 8: View types (list / calendar / kanban) and color mode

**Goal:** List, Calendar, and Kanban per directory; switch only via command palette. Color mode and show/hide completed.

**Spec reference:** §3 Views and navigation, §5 (color.*, view.completedToggle), §7.

**Implement:**
- **View type per directory:** Store current view type (list | calendar | kanban) per directory or globally; render the active column in that mode. Switch only via command palette commands (no Cmd+Shift+1/2/3).
- **Color mode:** Column display can color items by none, category, or priority (mod+alt+n, mod+alt+c, mod+alt+p). Spec §5.
- **Show/hide completed:** Toggle (Cmd+Shift+H). When "hide", filter out completed tasks; when "show", show them. Auto-archive: completed tasks stay in main view for 5 days, then move to archive (implement in Phase 10 or here; spec §4 Q55).

**Do not:** Saved views; Cmd+2…9; "Save current view" (Cmd+Alt+S).

**Done when:** User can switch list/calendar/kanban via palette only; color mode and show/hide completed work; completed tasks auto-archive after 5 days.

---

## Phase 9: Clipboard, selection, delete, undo/redo

**Goal:** Copy, copy recursive, cut, paste (single paste with metadata), multi-select, delete, undo/redo.

**Spec reference:** §5 Keyboard shortcuts (clipboard.*, task.delete, action.undo/redo), §7, §8.

**Implement:**
- **Copy / Cut / Paste:** Cmd+C, Cmd+X, Cmd+V in navigation context. One paste action that always applies metadata (spec: no separate "paste with metadata" or Cmd+Shift+V). Cmd+Shift+C = copy recursive (task + nested).
- **Multi-select:** Shift+Arrow Up/Down, Cmd+A in column; track selectedItems; bulk delete, bulk move, bulk copy/cut/paste.
- **Delete:** Cmd+Delete or Cmd+Backspace deletes selected; confirmation if required (confirm.yes / confirm.cancel with Enter/Escape).
- **Undo / Redo:** Cmd+Z / Cmd+Shift+Z; persist actions in action_history and replay; block in editing context so editor can handle its own undo (spec §5).

**Do not:** Separate "paste with metadata" shortcut; mobile multi-select toolbar (spec §8).

**Done when:** Copy/cut/paste (single paste = with metadata) and copy recursive work; multi-select and bulk delete work; undo/redo work and are persisted.

---

## Phase 10: Conflict resolution and offline

**Goal:** Version-based conflict detection, ConflictDialog (choose version/merge), offline cache, sync on reconnect.

**Spec reference:** §4 Data model (conflict resolution), §7, §10 Backend and auth.

**Implement:**
- **Version:** Every task and directory update increments `version`; send version on save; compare on conflict.
- **Conflict flow:** On save, if server version changed, run conflict resolution: find conflicting fields, show ConflictDialog. User can choose "mine", "theirs", or merge. Resolve and retry save. No last-write-wins only (spec Q54).
- **Offline:** Detect offline (networkStore); queue or cache mutations when offline; when back online, sync and run conflict resolution for any conflicting updates. Offline banner and connection indicator in header (spec §9).
- **Auto-archive:** When showing "completed" in main view, hide tasks completed more than 5 days ago (or move them to archive). Spec §4 Q55.

**Do not:** Skip conflict UI in favor of last-write-wins.

**Done when:** Conflicting edits show ConflictDialog; user can resolve; offline state shows banner and syncs on reconnect; completed tasks archive after 5 days.

---

## Phase 11: Grab mode and drag-and-drop

**Goal:** Keyboard move (grab mode) and mouse drag-and-drop with dots-only handle.

**Spec reference:** §5 (grab.*), §7 Features in scope.

**Implement:**
- **Grab mode:** In navigation context, Ctrl+Space then G enters grab mode. In grab context: Arrow keys move selection; Enter drops (commit move); Escape cancels. No sidebar, so "move to parent" / "move into directory" is relative to current column/path.
- **Drag and drop:** Mouse drag for reorder or move. Show drag handle (e.g. six dots) only when mouse is active or hovering over the handle (spec §7).

**Do not:** Always-visible drag handles; sidebar-based move targets.

**Done when:** User can move items with keyboard (grab mode) and with mouse (drag handle only when hovered/active).

---

## Phase 12: Search, Settings, Help and shortcut sheet

**Goal:** Search overlay, Settings view (shortcut remapping, theme), header arrow-key focus, Shortcut sheet, Help sheet.

**Spec reference:** §3 (header focus), §5 (search.open, settings.open, view.shortcutSheet), §7, §9.

**Implement:**
- **Search:** Cmd+Shift+S opens search overlay; filter tasks; keyboard nav (Escape to close). Search and other header controls reachable by Tab and arrow keys (spec Q32).
- **Header focus:** Ensure Search, Settings, Help are in tab order and that left/right (or specified) arrow keys move focus between them.
- **Settings view:** Cmd+, opens Settings (currentView = settings). Settings: theme (light/dark/system), accent color; keyboard shortcut remapping for actions in REMAPPABLE_ACTIONS (spec §5). Persist in user_settings.
- **Shortcut sheet:** Cmd+/ shows list of keyboard shortcuts (from spec §5). Keep as separate sheet unless product decision is to merge with Help (spec Q44 TBD).
- **Help sheet:** Content for getting started / help; open from Help in header.

**Do not:** Saved views or "save view" in settings.

**Done when:** Search works and is reachable from header; Settings allows theme and shortcut remapping; Cmd+/ shows shortcuts; Help opens help content; header is keyboard-navigable with arrows.

---

## Phase 13: Task links and Dependency Graph

**Goal:** Create/delete task links (reference/dependency); open Dependency Graph from command palette.

**Spec reference:** §2 (Dependency Graph), §4 (task_links), §7.

**Implement:**
- **Links:** Create link between two tasks (reference or dependency); delete link. Store in task_links; RLS. Cycle detection if needed.
- **Dependency Graph:** Command "Open Dependency Graph" in palette. Opens either in a temporary column or as part of the full task panel when the task has dependencies (spec Q56). Show graph of task links (nodes = tasks, edges = links).

**Do not:** "Go to [directory]" in palette; sidebar-based graph entry.

**Done when:** User can add/remove links between tasks and open Dependency Graph from the palette (temp column or panel expansion).

---

## Phase 14: Recurrence, checklist, and task status

**Goal:** Full recurrence pattern; checklist on tasks; task status and completed behavior.

**Spec reference:** §4 Data model, §7, §11 Q58.

**Implement:**
- **Recurrence:** Full pattern: frequency, interval, end date (and any other recurrence fields in schema). UI in full edit panel. When a recurring task is completed, create next occurrence (spec §4, Q58).
- **Checklist:** checklist_items on task (id, text, is_completed, position). Edit in full panel. Completed-task behavior: e.g. strikethrough or hide in "hide completed" mode; respect 5-day archive rule.
- **Status:** Task status (not_started, in_progress, finishing_touches, completed). Sync with is_completed (completed = status completed). Show in list and panel.

**Do not:** Time tracking (estimated_duration_minutes / actual_duration_minutes are kept as fields but no timer UI per spec; optional to show in panel only).

**Done when:** Recurrence can be set and next occurrence is created on complete; checklist works in panel; status is visible and synced with completion.

---

## Phase 15: Theme, onboarding, and mobile shell

**Goal:** Theme (light/dark/system + accent); onboarding flow; mobile FAB and bottom nav (Main, Search).

**Spec reference:** §1, §7, §9 UI and layout, §11 Q51–Q53.

**Implement:**
- **Theme:** themeStore: mode (light/dark/system), accent. Apply to root (e.g. data-theme, CSS vars). Persist in user_settings or localStorage. Flash-free: apply theme in index.html before first paint if possible.
- **Onboarding:** First-run onboarding flow (keep per spec Q53). Show once per user/device; dismissible.
- **Mobile:** Detect mobile viewport. FAB: single "New" that opens command palette (user chooses New task or New directory, then names inline). Bottom nav: Main and Search for now (spec Q51). No mobile multi-select toolbar.

**Do not:** Mobile-first feature creep; multi-select toolbar on mobile.

**Done when:** User can set theme and accent; onboarding shows on first run; on mobile, FAB opens palette and bottom nav has Main and Search.

---

## Phase 16: PWA and polish

**Goal:** Installable PWA; service worker; auto-archive and feedback toasts; final checks against spec.

**Spec reference:** §1 Overview, §7 Features in scope, §10 Backend and auth.

**Implement:**
- **PWA:** Web app manifest (name: Flowstate); service worker for caching and offline. Installable prompt if desired.
- **Auto-archive:** Ensure completed tasks are shown in main for 5 days then moved to archive (already in Phase 8/10; verify).
- **Feedback:** Toasts for success/error (feedbackStore); use for save, delete, conflict resolved, etc.
- **Spec pass:** Walk through APP_SPEC_REBUILD.md and confirm no in-scope item is missing and no out-of-scope item is present (no sidebar, no saved views, no time tracking, no CreationModal, no "Go to directory" in palette, one paste with metadata, no Alt+E, no Cmd+Shift+O).

**Done when:** App is installable as PWA; offline and sync work; toasts give feedback; spec compliance is verified.

---

## Summary table for Cursor

| Phase | Focus | Spec sections |
|-------|--------|----------------|
| 0 | Bootstrap, reference | §1, §10 |
| 1 | Backend, data, types | §4, §8, §10 |
| 2 | Auth, shell, view state | §1, §3, §9 |
| 3 | Stores, API | §4, §7, §8, §10 |
| 4 | Columns, breadcrumbs, nav keys | §3, §5, §9 |
| 5 | Command palette (Cmd+K, \\) | §2, §5, §7–§8 |
| 6 | Tasks, inline creation, multi-line | §6, §7, §8 |
| 7 | Full edit panel, attachments, url | §5, §7, §9 |
| 8 | List/Calendar/Kanban, color, completed | §3, §5, §7 |
| 9 | Clipboard, selection, delete, undo | §5, §7, §8 |
| 10 | Conflict resolution, offline | §4, §7, §10 |
| 11 | Grab mode, drag and drop | §5, §7 |
| 12 | Search, Settings, Help, shortcuts | §3, §5, §7, §9 |
| 13 | Links, Dependency Graph | §2, §4, §7 |
| 14 | Recurrence, checklist, status | §4, §7, §11 |
| 15 | Theme, onboarding, mobile | §1, §7, §9, §11 |
| 16 | PWA, polish, spec compliance | §1, §7, §10 |

When implementing a phase, open **APP_SPEC_REBUILD.md** and the listed sections; implement only what is in scope and omit what is explicitly out of scope.

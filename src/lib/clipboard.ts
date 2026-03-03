/**
 * Clipboard / paste behavior (spec §5, §8).
 *
 * Single paste action (Cmd+V) always applies metadata:
 * - No separate "paste with metadata" or Cmd+Shift+V.
 * - When pasting a task, preserve or apply directory, position, and other
 *   metadata as defined by the current context (target directory, selection).
 * Phase 9 implements the actual paste handler using this behavior.
 */

export const PASTE_ALWAYS_WITH_METADATA = true

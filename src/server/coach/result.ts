/**
 * Same `Result<T>` shape `src/server/actions.ts` exports for the top-level
 * action boundary (`00-CONTEXT.md §5`) — deliberately its own tiny module
 * rather than imported from `actions.ts`: nothing under `src/server/coach`
 * needs (or should reach into) the rest of that file's exports, and
 * `actions.ts` is a `'use server'` module — a value import from it registers
 * every one of its exports as a callable worker on whatever page imports the
 * importer, which `src/coach`'s own action-isolation story has no reason to
 * risk. One line duplicated, zero coupling.
 */
export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Barrel for the server actions in this directory, so call sites keep
 * importing from `@/lib/actions` unchanged.
 *
 * Each module below carries its own `"use server"` directive — this file
 * deliberately has none, since it only re-exports and declares no actions of
 * its own. Add a new feature module here rather than growing an existing one.
 */
export * from "./body";
export * from "./exercises";
export * from "./plans";
export * from "./profile";
export * from "./schedule";
export * from "./settings";
export * from "./workouts";

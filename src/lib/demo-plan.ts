import type { GeneratedPlan, LibraryExerciseChoice } from "@/lib/types";

/**
 * Deterministic, rule-based plan generator used when ANTHROPIC_API_KEY is
 * not configured, so the Generate page stays fully usable in demo mode.
 *
 * It draws exclusively from `library` — the caller's own exercise library —
 * for the same reason the AI path does: a plan naming movements the user never
 * added is a plan they can't log without the logger inventing rows. The caller
 * guarantees `library` is non-empty (an empty library is rejected before we get
 * here), but every day is still allowed to come out short rather than padded
 * with exercises that aren't there.
 */
export function buildDemoPlan(
  prompt: string,
  library: LibraryExerciseChoice[],
): GeneratedPlan {
  const lower = prompt.toLowerCase();

  const dayMatch = lower.match(/(\d)\s*(?:day|x|times)/);
  const daysPerWeek = clamp(dayMatch ? Number(dayMatch[1]) : 3, 1, 6);

  const dumbbellOnly = /dumbbell/.test(lower) && /only|just|home/.test(lower);
  const bodyweightOnly = /(bodyweight|body weight|no equipment|calisthenic)/.test(lower);
  const strength = /(strength|strong|power|5x5)/.test(lower);

  const reps = strength ? "4-6" : "8-12";
  const restSec = strength ? 180 : 90;

  // Equipment preference is a preference, not a hard filter: if the user's
  // library can't cover it, a short plan of the wrong equipment beats no plan.
  const equipmentMatch = bodyweightOnly
    ? (e: LibraryExerciseChoice) => /body ?weight|assisted/.test(e.equipment)
    : dumbbellOnly
      ? (e: LibraryExerciseChoice) => /dumbbell|body ?weight/.test(e.equipment)
      : null;
  const preferred = equipmentMatch ? library.filter(equipmentMatch) : library;
  const pool = preferred.length >= 3 ? preferred : library;

  const byBucket = new Map<string, LibraryExerciseChoice[]>();
  for (const exercise of pool) {
    const bucket = byBucket.get(exercise.bodyPart) ?? [];
    bucket.push(exercise);
    byBucket.set(exercise.bodyPart, bucket);
  }

  // Each template is a day's slots in priority order: a body part, plus an
  // optional target pattern that splits a bucket the app doesn't — "arms" holds
  // both biceps and triceps, and a curl has no business on push day.
  const PUSH_ARM = /tricep/;
  const PULL_ARM = /bicep|forearm/;
  const templates: Record<string, Slot[]> = {
    push: [["chest"], ["shoulders"], ["chest"], ["arms", PUSH_ARM], ["arms", PUSH_ARM]],
    pull: [["back"], ["back"], ["shoulders"], ["arms", PULL_ARM], ["arms", PULL_ARM]],
    legs: [["legs"], ["legs"], ["legs"], ["calves"], ["core"]],
    upper: [["chest"], ["back"], ["shoulders"], ["arms", PULL_ARM], ["arms", PUSH_ARM]],
    full: [["legs"], ["chest"], ["back"], ["shoulders"], ["core"]],
  };

  const dayNames: Record<number, [string, keyof typeof templates][]> = {
    1: [["Full Body", "full"]],
    2: [["Full Body A", "full"], ["Full Body B", "upper"]],
    3: [["Push Day", "push"], ["Pull Day", "pull"], ["Leg Day", "legs"]],
    4: [["Upper A", "upper"], ["Lower A", "legs"], ["Upper B", "push"], ["Lower B", "legs"]],
    5: [["Push Day", "push"], ["Pull Day", "pull"], ["Leg Day", "legs"], ["Upper Body", "upper"], ["Full Body", "full"]],
    6: [["Push Day", "push"], ["Pull Day", "pull"], ["Leg Day", "legs"], ["Upper Body", "upper"], ["Lower Body", "legs"], ["Full Body", "full"]],
  };

  const days = dayNames[daysPerWeek].map(([name, template]) => ({
    name,
    exercises: pickDay(templates[template], byBucket, pool).map((exercise, index) => ({
      name: exercise.name,
      sets: index === 0 && strength ? 5 : 3,
      reps: index === 0 ? reps : "8-12",
      restSec: index === 0 ? restSec : 90,
      notes: "",
    })),
  }));

  return {
    name: `${daysPerWeek}-Day ${strength ? "Strength" : "Hypertrophy"} Plan`,
    description:
      "Demo plan built locally from your request and your exercise library. Add a set or a little weight to the first exercise of each day every week. Add an Anthropic API key to get fully personalized AI plans.",
    days,
  };
}

/** One slot of a day: a body part, optionally narrowed to matching targets. */
type Slot = [bodyPart: string, target?: RegExp];

/** A day is never padded below this from off-template buckets. */
const MIN_EXERCISES_PER_DAY = 3;

/**
 * One day: walks the template's slots, taking an unused exercise from each, then
 * tops the day up from the rest of the pool only if it came out unusably short.
 * A day whose body parts simply aren't in the library stays short on purpose —
 * better than a "Leg Day" finished off with a bench press.
 */
function pickDay(
  template: Slot[],
  byBucket: Map<string, LibraryExerciseChoice[]>,
  pool: LibraryExerciseChoice[],
): LibraryExerciseChoice[] {
  const picked: LibraryExerciseChoice[] = [];
  const used = new Set<string>();

  for (const [bodyPart, target] of template) {
    const bucket = byBucket.get(bodyPart);
    if (!bucket) continue;
    const free = bucket.filter((e) => !used.has(e.name));
    // Rotation within a bucket is per-day, so two slots on the same body part
    // don't both take the first entry; the target filter is a preference, since
    // a small library may hold no triceps movement at all.
    const next = (target && free.find((e) => target.test(e.target))) ?? free[0];
    if (next) {
      picked.push(next);
      used.add(next.name);
    }
  }
  for (const exercise of pool) {
    if (picked.length >= Math.min(MIN_EXERCISES_PER_DAY, pool.length)) break;
    if (used.has(exercise.name)) continue;
    picked.push(exercise);
    used.add(exercise.name);
  }
  // Rotate each bucket so the next day starts one exercise further along.
  for (const exercise of picked) {
    const bucket = byBucket.get(exercise.bodyPart);
    if (bucket && bucket.length > 1) {
      bucket.push(...bucket.splice(bucket.indexOf(exercise), 1));
    }
  }
  return picked;
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

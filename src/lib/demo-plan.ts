import type { GeneratedPlan } from "@/lib/types";

/**
 * Deterministic, rule-based plan generator used when ANTHROPIC_API_KEY is
 * not configured, so the Generate page stays fully usable in demo mode.
 */
export function buildDemoPlan(prompt: string): GeneratedPlan {
  const lower = prompt.toLowerCase();

  const dayMatch = lower.match(/(\d)\s*(?:day|x|times)/);
  const daysPerWeek = clamp(dayMatch ? Number(dayMatch[1]) : 3, 1, 6);

  const dumbbellOnly = /dumbbell/.test(lower) && /only|just|home/.test(lower);
  const bodyweightOnly = /(bodyweight|body weight|no equipment|calisthenic)/.test(lower);
  const strength = /(strength|strong|power|5x5)/.test(lower);

  const reps = strength ? "4-6" : "8-12";
  const restSec = strength ? 180 : 90;

  const pick = (gym: string, dumbbell: string, bodyweight: string) =>
    bodyweightOnly ? bodyweight : dumbbellOnly ? dumbbell : gym;

  const push = [
    ex(pick("Barbell Bench Press", "Dumbbell Bench Press", "Push-Up"), strength ? 5 : 4, reps, restSec, "Main press — add weight or reps each week."),
    ex(pick("Overhead Press", "Seated Dumbbell Shoulder Press", "Pike Push-Up"), 3, reps, restSec, ""),
    ex(pick("Incline Dumbbell Press", "Incline Dumbbell Press", "Decline Push-Up"), 3, "8-12", 90, ""),
    ex(pick("Lateral Raise", "Lateral Raise", "Plank"), 3, "12-15", 60, ""),
    ex(pick("Triceps Pushdown", "Overhead Triceps Extension", "Dips"), 3, "10-15", 60, ""),
  ];
  const pull = [
    ex(pick("Deadlift", "Romanian Deadlift", "Pull-Up"), strength ? 5 : 3, strength ? "3-5" : reps, restSec, "Brace hard, keep the bar close."),
    ex(pick("Pull-Up", "Single-Arm Dumbbell Row", "Chin-Up"), 3, "6-10", 120, ""),
    ex(pick("Seated Cable Row", "Single-Arm Dumbbell Row", "Inverted Row"), 3, reps, 90, ""),
    ex(pick("Face Pull", "Rear Delt Fly", "Superman Hold"), 3, "12-15", 60, ""),
    ex(pick("Barbell Curl", "Dumbbell Curl", "Chin-Up (close grip)"), 3, "10-12", 60, ""),
  ];
  const legs = [
    ex(pick("Barbell Back Squat", "Goblet Squat", "Bodyweight Squat"), strength ? 5 : 4, strength ? "4-6" : reps, restSec, "Depth first, then load."),
    ex(pick("Romanian Deadlift", "Romanian Deadlift", "Single-Leg Hip Thrust"), 3, reps, 120, ""),
    ex(pick("Leg Press", "Walking Lunge", "Walking Lunge"), 3, "10-12", 90, ""),
    ex(pick("Seated Leg Curl", "Bulgarian Split Squat", "Bulgarian Split Squat"), 3, "10-12", 90, ""),
    ex(pick("Standing Calf Raise", "Standing Calf Raise", "Single-Leg Calf Raise"), 4, "12-15", 60, ""),
  ];
  const fullBody = [
    ex(pick("Barbell Back Squat", "Goblet Squat", "Bodyweight Squat"), 3, reps, restSec, ""),
    ex(pick("Barbell Bench Press", "Dumbbell Bench Press", "Push-Up"), 3, reps, restSec, ""),
    ex(pick("Barbell Row", "Single-Arm Dumbbell Row", "Inverted Row"), 3, reps, 90, ""),
    ex(pick("Overhead Press", "Seated Dumbbell Shoulder Press", "Pike Push-Up"), 3, "8-10", 90, ""),
    ex(pick("Plank", "Plank", "Plank"), 3, "30-60s", 60, ""),
  ];
  const upper = [...push.slice(0, 3), pull[1], pull[4]];
  const lower_ = legs.slice(0, 5);

  let days: GeneratedPlan["days"];
  if (daysPerWeek <= 2) {
    days = label(["Full Body A", "Full Body B"].slice(0, daysPerWeek), [fullBody, fullBody]);
  } else if (daysPerWeek === 3) {
    days = label(["Push Day", "Pull Day", "Leg Day"], [push, pull, legs]);
  } else if (daysPerWeek === 4) {
    days = label(["Upper A", "Lower A", "Upper B", "Lower B"], [upper, lower_, upper, lower_]);
  } else {
    days = label(
      ["Push Day", "Pull Day", "Leg Day", "Upper Body", "Lower Body", "Full Body"].slice(0, daysPerWeek),
      [push, pull, legs, upper, lower_, fullBody],
    );
  }

  return {
    name: `${daysPerWeek}-Day ${strength ? "Strength" : "Hypertrophy"} Plan`,
    description:
      "Demo plan generated locally from your request. Add an Anthropic API key to get fully personalized AI plans.",
    days,
  };
}

function ex(
  name: string,
  sets: number,
  reps: string,
  restSec: number,
  notes: string,
) {
  return { name, sets, reps, restSec, notes };
}

function label(
  names: string[],
  blocks: ReturnType<typeof ex>[][],
): GeneratedPlan["days"] {
  return names.map((name, i) => ({ name, exercises: blocks[i % blocks.length] }));
}

function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

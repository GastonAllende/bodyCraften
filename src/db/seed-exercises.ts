/**
 * Built-in exercise library used when no external exercise API key is
 * configured, and as the starting library for the workout logger.
 * Fields mirror the ExerciseDB shape: bodyPart / equipment / target.
 */
export type SeedExercise = {
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
};

export const SEED_EXERCISES: SeedExercise[] = [
  // Chest
  { name: "Barbell Bench Press", bodyPart: "chest", equipment: "barbell", target: "pectorals" },
  { name: "Incline Barbell Bench Press", bodyPart: "chest", equipment: "barbell", target: "upper pectorals" },
  { name: "Dumbbell Bench Press", bodyPart: "chest", equipment: "dumbbell", target: "pectorals" },
  { name: "Incline Dumbbell Press", bodyPart: "chest", equipment: "dumbbell", target: "upper pectorals" },
  { name: "Dumbbell Fly", bodyPart: "chest", equipment: "dumbbell", target: "pectorals" },
  { name: "Cable Crossover", bodyPart: "chest", equipment: "cable", target: "pectorals" },
  { name: "Machine Chest Press", bodyPart: "chest", equipment: "machine", target: "pectorals" },
  { name: "Push-Up", bodyPart: "chest", equipment: "body weight", target: "pectorals" },
  { name: "Dips", bodyPart: "chest", equipment: "body weight", target: "lower pectorals" },

  // Back
  { name: "Deadlift", bodyPart: "back", equipment: "barbell", target: "spinal erectors" },
  { name: "Barbell Row", bodyPart: "back", equipment: "barbell", target: "lats" },
  { name: "Pull-Up", bodyPart: "back", equipment: "body weight", target: "lats" },
  { name: "Chin-Up", bodyPart: "back", equipment: "body weight", target: "lats" },
  { name: "Lat Pulldown", bodyPart: "back", equipment: "cable", target: "lats" },
  { name: "Seated Cable Row", bodyPart: "back", equipment: "cable", target: "mid back" },
  { name: "Single-Arm Dumbbell Row", bodyPart: "back", equipment: "dumbbell", target: "lats" },
  { name: "T-Bar Row", bodyPart: "back", equipment: "barbell", target: "mid back" },
  { name: "Face Pull", bodyPart: "back", equipment: "cable", target: "rear delts" },
  { name: "Back Extension", bodyPart: "back", equipment: "body weight", target: "spinal erectors" },

  // Legs
  { name: "Barbell Back Squat", bodyPart: "legs", equipment: "barbell", target: "quads" },
  { name: "Front Squat", bodyPart: "legs", equipment: "barbell", target: "quads" },
  { name: "Romanian Deadlift", bodyPart: "legs", equipment: "barbell", target: "hamstrings" },
  { name: "Leg Press", bodyPart: "legs", equipment: "machine", target: "quads" },
  { name: "Walking Lunge", bodyPart: "legs", equipment: "dumbbell", target: "quads" },
  { name: "Bulgarian Split Squat", bodyPart: "legs", equipment: "dumbbell", target: "quads" },
  { name: "Leg Extension", bodyPart: "legs", equipment: "machine", target: "quads" },
  { name: "Seated Leg Curl", bodyPart: "legs", equipment: "machine", target: "hamstrings" },
  { name: "Hip Thrust", bodyPart: "legs", equipment: "barbell", target: "glutes" },
  { name: "Goblet Squat", bodyPart: "legs", equipment: "dumbbell", target: "quads" },
  { name: "Standing Calf Raise", bodyPart: "legs", equipment: "machine", target: "calves" },
  { name: "Seated Calf Raise", bodyPart: "legs", equipment: "machine", target: "calves" },

  // Shoulders
  { name: "Overhead Press", bodyPart: "shoulders", equipment: "barbell", target: "delts" },
  { name: "Seated Dumbbell Shoulder Press", bodyPart: "shoulders", equipment: "dumbbell", target: "delts" },
  { name: "Lateral Raise", bodyPart: "shoulders", equipment: "dumbbell", target: "side delts" },
  { name: "Cable Lateral Raise", bodyPart: "shoulders", equipment: "cable", target: "side delts" },
  { name: "Front Raise", bodyPart: "shoulders", equipment: "dumbbell", target: "front delts" },
  { name: "Rear Delt Fly", bodyPart: "shoulders", equipment: "dumbbell", target: "rear delts" },
  { name: "Arnold Press", bodyPart: "shoulders", equipment: "dumbbell", target: "delts" },
  { name: "Upright Row", bodyPart: "shoulders", equipment: "barbell", target: "traps" },
  { name: "Barbell Shrug", bodyPart: "shoulders", equipment: "barbell", target: "traps" },

  // Arms
  { name: "Barbell Curl", bodyPart: "arms", equipment: "barbell", target: "biceps" },
  { name: "Dumbbell Curl", bodyPart: "arms", equipment: "dumbbell", target: "biceps" },
  { name: "Hammer Curl", bodyPart: "arms", equipment: "dumbbell", target: "brachialis" },
  { name: "Incline Dumbbell Curl", bodyPart: "arms", equipment: "dumbbell", target: "biceps" },
  { name: "Preacher Curl", bodyPart: "arms", equipment: "machine", target: "biceps" },
  { name: "Cable Curl", bodyPart: "arms", equipment: "cable", target: "biceps" },
  { name: "Close-Grip Bench Press", bodyPart: "arms", equipment: "barbell", target: "triceps" },
  { name: "Triceps Pushdown", bodyPart: "arms", equipment: "cable", target: "triceps" },
  { name: "Overhead Triceps Extension", bodyPart: "arms", equipment: "dumbbell", target: "triceps" },
  { name: "Skull Crusher", bodyPart: "arms", equipment: "barbell", target: "triceps" },
  { name: "Wrist Curl", bodyPart: "arms", equipment: "dumbbell", target: "forearms" },

  // Core
  { name: "Plank", bodyPart: "core", equipment: "body weight", target: "abs" },
  { name: "Hanging Leg Raise", bodyPart: "core", equipment: "body weight", target: "lower abs" },
  { name: "Cable Crunch", bodyPart: "core", equipment: "cable", target: "abs" },
  { name: "Russian Twist", bodyPart: "core", equipment: "body weight", target: "obliques" },
  { name: "Ab Wheel Rollout", bodyPart: "core", equipment: "wheel roller", target: "abs" },
  { name: "Side Plank", bodyPart: "core", equipment: "body weight", target: "obliques" },
  { name: "Crunch", bodyPart: "core", equipment: "body weight", target: "abs" },
  { name: "Dead Bug", bodyPart: "core", equipment: "body weight", target: "abs" },

  // Cardio / conditioning
  { name: "Treadmill Run", bodyPart: "cardio", equipment: "machine", target: "cardiovascular system" },
  { name: "Rowing Machine", bodyPart: "cardio", equipment: "machine", target: "cardiovascular system" },
  { name: "Stationary Bike", bodyPart: "cardio", equipment: "machine", target: "cardiovascular system" },
  { name: "Jump Rope", bodyPart: "cardio", equipment: "rope", target: "cardiovascular system" },
  { name: "Kettlebell Swing", bodyPart: "cardio", equipment: "kettlebell", target: "glutes" },
  { name: "Burpee", bodyPart: "cardio", equipment: "body weight", target: "cardiovascular system" },
  { name: "Farmer's Carry", bodyPart: "cardio", equipment: "dumbbell", target: "full body" },
];

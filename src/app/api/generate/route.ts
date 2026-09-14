import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { buildDemoPlan } from "@/lib/demo-plan";
import { buildGeneratePlanPrompt } from "@/lib/generate-plan-prompts";
import { getDictionary } from "@/lib/i18n/server";
import { getLibraryExerciseChoices } from "@/lib/queries";
import {
  EMPTY_LIBRARY_CODE,
  type GeneratedPlan,
  type LibraryExerciseChoice,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const planSchema = z.object({
  name: z.string().describe("Short, motivating plan name"),
  description: z
    .string()
    .describe("1-2 sentences: who the plan is for and how to progress it"),
  days: z
    .array(
      z.object({
        name: z.string().describe('Day label, e.g. "Push Day"'),
        exercises: z.array(
          z.object({
            // Deliberately unconstrained beyond "a string": the old regex here
            // banned "/" and the word "or" to stop the model bundling
            // alternatives ("Pull-ups or Lat Pulldown"). Now that names must
            // come from the user's library, the allow-list does that job, and
            // the regex only rejected legitimate library names — a plan using
            // the catalog's "3/4 Sit-up" failed to parse and 500'd. Off-list
            // names are dropped by `keepOnlyLibraryExercises()` instead.
            name: z
              .string()
              .describe(
                "One exercise, copied exactly from the allowed list in the system prompt",
              ),
            sets: z.number().int().describe("Number of working sets"),
            reps: z
              .string()
              .regex(/^\d+(-\d+)?$/)
              .describe(
                'Rep target as digits only — a count "10" or a range "8-12". Never a unit or word.',
              ),
            restSec: z.number().int().describe("Rest between sets in seconds"),
            notes: z
              .string()
              .describe("Short form cue or progression tip; empty if none"),
          }),
        ),
      }),
    )
    .describe("One entry per training day per week"),
});

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to do that." }, { status: 401 });
  }

  let prompt: unknown;
  try {
    ({ prompt } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof prompt !== "string" || prompt.trim().length < 8) {
    return NextResponse.json(
      { error: "Describe your workout in a sentence or two first." },
      { status: 400 },
    );
  }

  // A plan may only name exercises the user actually has, so an empty library
  // makes generation impossible rather than merely worse. The page disables the
  // form in that case too; this is the check that actually holds, since a route
  // handler is a public endpoint.
  const library = await getLibraryExerciseChoices(user.id);
  if (library.length === 0) {
    const t = await getDictionary();
    return NextResponse.json(
      { error: t.generatePage.emptyLibraryError, code: EMPTY_LIBRARY_CODE },
      { status: 422 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ plan: buildDemoPlan(prompt, library), demo: true });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      // Haiku 4.5 handles this schema-constrained task well at ~1/8 the cost of
      // Opus. It supports neither `thinking: {type: "adaptive"}` nor `effort` —
      // both return a 400 — so neither is set here.
      model: "claude-haiku-4-5",
      max_tokens: 16000,
      system: buildGeneratePlanPrompt(library),
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(planSchema) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { error: "The model couldn't produce a plan for that request. Try rephrasing it." },
        { status: 502 },
      );
    }

    const plan = keepOnlyLibraryExercises(response.parsed_output, library);
    if (plan.days.length === 0) {
      const t = await getDictionary();
      return NextResponse.json(
        { error: t.generatePage.noLibraryMatchError },
        { status: 502 },
      );
    }

    return NextResponse.json({ plan, demo: false });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Your ANTHROPIC_API_KEY seems invalid. Check .env.local." },
        { status: 401 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error (${error.status}). Try again in a moment.` },
        { status: 502 },
      );
    }
    // Everything the SDK itself raises, most usefully a structured-output parse
    // failure — the model answered, but not in the shape `planSchema` demands.
    // That's a bad response, not a broken server, so don't report it as a 500.
    if (error instanceof Anthropic.AnthropicError) {
      console.error("Plan generation failed to parse:", error);
      const t = await getDictionary();
      return NextResponse.json(
        { error: t.generatePage.unreadablePlanError },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Unexpected error while generating the plan." },
      { status: 500 },
    );
  }
}

/**
 * Second line of defence behind the prompt's allow-list: drops any exercise the
 * model named that isn't in the library, and any day left empty by that. Names
 * are matched case-insensitively but rewritten to the library's exact spelling,
 * since that string becomes `plan_exercises.exercise_name` — the join key the
 * rest of the app matches history and library rows on.
 */
function keepOnlyLibraryExercises(
  plan: GeneratedPlan,
  library: LibraryExerciseChoice[],
): GeneratedPlan {
  const canonical = new Map(library.map((e) => [e.name.trim().toLowerCase(), e.name]));

  const days = plan.days
    .map((day) => {
      const seen = new Set<string>();
      return {
        ...day,
        exercises: day.exercises.flatMap((exercise) => {
          const name = canonical.get(exercise.name.trim().toLowerCase());
          if (!name || seen.has(name)) return [];
          seen.add(name);
          return [{ ...exercise, name }];
        }),
      };
    })
    .filter((day) => day.exercises.length > 0);

  return { ...plan, days };
}

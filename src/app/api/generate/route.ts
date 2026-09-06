import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { buildDemoPlan } from "@/lib/demo-plan";
import { CURRENT_GENERATE_PLAN_PROMPT } from "@/lib/generate-plan-prompts";

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
            name: z.string().describe("Common gym name of the exercise"),
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
    .length(1)
    .describe("Exactly one entry — a single workout session, not a weekly split"),
});

const SYSTEM_PROMPT = CURRENT_GENERATE_PLAN_PROMPT;

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ plan: buildDemoPlan(prompt), demo: true });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      // Haiku 4.5 handles this schema-constrained task well at ~1/8 the cost of
      // Opus. It supports neither `thinking: {type: "adaptive"}` nor `effort` —
      // both return a 400 — so neither is set here.
      model: "claude-haiku-4-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(planSchema) },
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json(
        { error: "The model couldn't produce a plan for that request. Try rephrasing it." },
        { status: 502 },
      );
    }

    return NextResponse.json({ plan: response.parsed_output, demo: false });
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
    return NextResponse.json(
      { error: "Unexpected error while generating the plan." },
      { status: 500 },
    );
  }
}

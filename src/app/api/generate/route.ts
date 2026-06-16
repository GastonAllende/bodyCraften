import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { buildDemoPlan } from "@/lib/demo-plan";

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
              .describe('Rep target or range, e.g. "8-12" or "30-60s"'),
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

const SYSTEM_PROMPT = `You are an experienced strength and conditioning coach.
Design a weekly gym plan from the user's request.

Rules:
- Respect every constraint the user states (days per week, equipment, time, experience, injuries, goals).
- Pick proven compound movements first, then accessories. Use common exercise names.
- Keep each day realistic: 4-7 exercises for a typical session, fewer if the user is time-constrained.
- Program for progressive overload: include a concrete progression tip in the plan description.
- If the user writes in another language, answer exercise names in English but day names and notes in their language.`;

export async function POST(req: Request) {
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
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
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

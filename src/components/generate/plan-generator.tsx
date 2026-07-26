"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Info, RotateCcw, Save, Sparkles, Timer } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";
import { createPlan } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import type { GeneratedPlan } from "@/lib/types";

export function PlanGenerator({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, startSaving] = useTransition();

  async function generate() {
    if (prompt.trim().length < 8) {
      toast.error(t.generatePage.promptTooShort);
      return;
    }
    setLoading(true);
    setPlan(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as {
        plan?: GeneratedPlan;
        demo?: boolean;
        error?: string;
      };
      if (!res.ok || !data.plan) {
        toast.error(data.error ?? t.generatePage.generateFailed);
        return;
      }
      setPlan(data.plan);
      setIsDemo(Boolean(data.demo));
    } catch {
      toast.error(t.generatePage.networkError);
    } finally {
      setLoading(false);
    }
  }

  function savePlan() {
    if (!plan) return;
    startSaving(async () => {
      const result = await createPlan({
        name: plan.name,
        description: plan.description,
        source: "ai",
        days: plan.days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            restSec: e.restSec || undefined,
            notes: e.notes || undefined,
          })),
        })),
      });
      if (result.ok) {
        toast.success(fmt(t.generatePage.savedToPlans, { name: plan.name }), {
          description: t.generatePage.savedToPlansDesc,
        });
        router.push("/plans");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!aiEnabled && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>{t.generatePage.demoMode}</AlertTitle>
          <AlertDescription>
            {t.generatePage.demoDescBefore} <code>.env.local</code>{" "}
            {t.generatePage.demoDescAfter}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t.generatePage.describeTitle}
          </CardTitle>
          <CardDescription>{t.generatePage.describeDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.generatePage.promptPlaceholder}
            rows={4}
            className="resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {t.generatePage.examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={loading}>
              <Sparkles className="size-4" />
              {loading ? t.generatePage.generating : t.generatePage.generate}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card aria-busy>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {plan && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Card className="border-primary/30">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isDemo && (
                    <Badge variant="secondary">{t.generatePage.demoBadge}</Badge>
                  )}
                  {!isDemo && (
                    <Badge className="gap-1 bg-violet-500/15 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400">
                      <Sparkles className="size-3" /> AI
                    </Badge>
                  )}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  className="grid gap-3 md:grid-cols-2"
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: {},
                    show: { transition: { staggerChildren: 0.07 } },
                  }}
                >
                  {plan.days.map((day) => (
                    <motion.div
                      key={day.name}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: { opacity: 1, y: 0 },
                      }}
                      className="rounded-lg border p-3"
                    >
                      <div className="font-medium">{day.name}</div>
                      <ul className="mt-2 space-y-1.5">
                        {day.exercises.map((exercise) => (
                          <li key={exercise.name} className="text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span>{exercise.name}</span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {exercise.sets} × {exercise.reps}
                              </span>
                            </div>
                            {(exercise.restSec > 0 || exercise.notes) && (
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                                {exercise.restSec > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <Timer className="size-3" />
                                    {exercise.restSec}s
                                  </span>
                                )}
                                {exercise.notes && <span>{exercise.notes}</span>}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </motion.div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setPlan(null)}>
                    {t.generatePage.discard}
                  </Button>
                  <Button variant="secondary" onClick={generate}>
                    <RotateCcw className="size-4" /> {t.generatePage.regenerate}
                  </Button>
                  <Button onClick={savePlan} disabled={saving}>
                    <Save className="size-4" />
                    {saving ? t.generatePage.saving : t.generatePage.saveAsPlan}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

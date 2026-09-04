"use client";

import { motion } from "motion/react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/i18n-provider";
import { formatVolume } from "@/lib/overload";

export function WorkoutSummaryBar({
  totalVolume,
  completedSets,
  saving,
  onFinish,
}: {
  totalVolume: number;
  completedSets: number;
  saving: boolean;
  onFinish: () => void;
}) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky bottom-20 z-30 md:bottom-4"
    >
      <Card className="border-primary/20 shadow-lg">
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-4 pl-1 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">
                {t.logger.volume}
              </div>
              <div className="font-semibold tabular-nums">
                {formatVolume(totalVolume)}
              </div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <div className="text-xs text-muted-foreground">
                {t.logger.sets}
              </div>
              <div className="font-semibold tabular-nums">{completedSets}</div>
            </div>
          </div>
          <Button
            size="lg"
            onClick={onFinish}
            disabled={saving || completedSets === 0}
          >
            <CheckCheck className="size-4" />
            {saving ? t.logger.saving : t.logger.finishWorkout}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

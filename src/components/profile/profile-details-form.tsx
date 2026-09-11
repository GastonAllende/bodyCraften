"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/components/i18n-provider";
import { updateProfile } from "@/lib/actions";
import { fmt } from "@/lib/i18n/config";
import type { ProfileInput } from "@/lib/types";
import {
  GENDER_OPTIONS,
  isValidBirthDate,
  sanitizeName,
} from "@/lib/validation";

/** Latest date the picker will accept — you can't be born tomorrow. */
function todayForInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function ageFrom(birthDate: string): number | null {
  if (!isValidBirthDate(birthDate) || birthDate === "") return null;
  const born = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function ProfileDetailsForm({ profile }: { profile: ProfileInput }) {
  const router = useRouter();
  const { t } = useI18n();
  const [saving, startSaving] = useTransition();
  const [form, setForm] = useState<ProfileInput>(profile);

  // Compared against the last *saved* values, not the initial props, so the
  // footer settles back to "nothing to save" after a successful write without
  // needing a full page refresh to notice.
  const [saved, setSaved] = useState<ProfileInput>(profile);

  const dirty = useMemo(
    () => (Object.keys(form) as (keyof ProfileInput)[]).some(
      (key) => form[key].trim() !== saved[key].trim(),
    ),
    [form, saved],
  );

  // The only client-reachable invalid state: `sanitizeName` caps length on
  // every keystroke, so a too-long name can't be typed or pasted in.
  const birthDateError = !isValidBirthDate(form.birthDate);
  const valid = !birthDateError;

  const age = ageFrom(form.birthDate);

  function setField(key: keyof ProfileInput, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || !dirty) return;
    startSaving(async () => {
      const result = await updateProfile(form);
      if (result.ok) {
        setSaved(form);
        toast.success(t.actions.profileSaved);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const nameFields = [
    {
      key: "firstName" as const,
      label: t.profilePage.firstName,
      description: null,
      autoComplete: "given-name",
    },
    {
      key: "lastName" as const,
      label: t.profilePage.lastName,
      description: null,
      autoComplete: "family-name",
    },
    {
      key: "displayName" as const,
      label: t.profilePage.displayName,
      description: t.profilePage.displayNameHelp,
      autoComplete: "nickname",
    },
  ];

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{t.profilePage.personalSection}</CardTitle>
          <CardDescription>{t.profilePage.personalHelp}</CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            {nameFields.map((field) => (
              <Field key={field.key}>
                <FieldLabel htmlFor={field.key}>{field.label}</FieldLabel>
                <Input
                  id={field.key}
                  value={form[field.key]}
                  autoComplete={field.autoComplete}
                  onChange={(event) =>
                    setField(field.key, sanitizeName(event.target.value))
                  }
                />
                {field.description ? (
                  <FieldDescription>{field.description}</FieldDescription>
                ) : null}
              </Field>
            ))}

            <Field data-invalid={birthDateError || undefined}>
              <FieldLabel htmlFor="birthDate">
                {t.profilePage.birthDate}
              </FieldLabel>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                max={todayForInput()}
                autoComplete="bday"
                aria-invalid={birthDateError || undefined}
                onChange={(event) => setField("birthDate", event.target.value)}
                className="w-full sm:max-w-56"
              />
              {birthDateError ? (
                <FieldError>{t.profilePage.errorBirthDateFuture}</FieldError>
              ) : (
                <FieldDescription>
                  {age === null
                    ? t.profilePage.birthDateHelp
                    : fmt(t.profilePage.ageSuffix, { age })}
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="gender">{t.profilePage.gender}</FieldLabel>
              <ToggleGroup
                id="gender"
                type="single"
                variant="outline"
                value={form.gender}
                // Radix hands back "" when the active item is pressed again,
                // which is exactly how the field gets cleared back to unset.
                onValueChange={(value) => setField("gender", value)}
                className="flex flex-wrap justify-start gap-2"
              >
                {GENDER_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    aria-label={t.profilePage[GENDER_LABEL_KEYS[option]]}
                  >
                    {t.profilePage[GENDER_LABEL_KEYS[option]]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>{t.profilePage.genderClear}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>

        <CardFooter className="border-t bg-muted/30">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {dirty ? t.profilePage.unsavedChanges : null}
            </p>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setForm(saved)}
                >
                  {t.profilePage.discard}
                </Button>
              ) : null}
              <Button type="submit" disabled={!valid || !dirty || saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {saving ? t.profilePage.saving : t.profilePage.save}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}

/** Maps a stored gender value to its dictionary key. */
const GENDER_LABEL_KEYS = {
  female: "genderFemale",
  male: "genderMale",
  other: "genderOther",
  prefer_not_to_say: "genderPreferNotToSay",
} as const;

#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Rewrites `npm run build` / `npm run lint`
# to run through run-filtered.sh, which trims noisy success output and caps
# failure output while keeping errors/warnings and the tail summary.
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

case "$cmd" in
  "npm run build"|"npm run build "*|"npm run lint"|"npm run lint "*)
    new_cmd="bash .claude/hooks/run-filtered.sh $cmd"
    jq -n --arg cmd "$new_cmd" \
      '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"allow",updatedInput:{command:$cmd}}}'
    ;;
  *)
    exit 0
    ;;
esac

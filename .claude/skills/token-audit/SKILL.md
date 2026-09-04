---
name: token-audit
description: Audit this Claude Code setup for token waste — memory files, MCP tools, model/effort settings, hooks, subagents, scheduled jobs, and cache efficiency from the latest session log. Report-only, no fixes. Use when the user asks to audit token usage, context bloat, cache efficiency, or "why is this session so expensive."
---

# Token waste audit

Measure, do not estimate. Write `UNKNOWN` rather than guessing. Change no file
and no setting — this is report-only.

If you cannot invoke slash commands yourself, ask the user to run `/context`
and `/usage` and paste the output, then continue with the rest of the audit
using shell and file tools.

## 1. Memory

Find every `CLAUDE.md` in scope: this project, parent directories, the user
level one (`~/.claude/CLAUDE.md`), and anything pulled in via `@imports`.
Report each file's size in tokens (approximate from byte/word count if no
tokenizer is available, and label it as approximate). Flag any single file
over 5k tokens and any total over 10k.

## 2. Tools

List connected MCP servers and how many tools each exposes. State plainly
whether tool deferral is ACTIVE or NOT. Then check for a proxy or gateway
(`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, any gateway env variable) and
say so loudly if found — routing through a proxy silently turns deferral off
and nothing else will warn about it.

## 3. Model

Report the current model and effort level and where each is set. Flag any
mode that changes model automatically during a session, since every switch
rebuilds the whole prompt cache.

## 4. Hooks

List any `PreToolUse` hooks that rewrite noisy commands to produce less
output. If there are none, say so explicitly — unfiltered test/build output
lands in context verbatim and is re-sent for the rest of the session.

## 5. Subagents

List every agent file in the project (`.claude/agents/`, `.agents/`) and user
(`~/.claude/agents/`) agent directories. For each, report whether it sets an
explicit `model` in frontmatter or inherits the main session's model.

## 6. Scheduled work

List every cron job, scheduled task, and background job with its interval.
Compare each interval against the prompt cache lifetime (~1 hour). Flag every
one whose interval is longer, since those miss cache on every fire.

## 7. Cache

Parse the newest session log under the Claude projects directory
(`~/.claude/projects/`). For every assistant turn, sum
`usage.cache_read_input_tokens`, `cache_creation_input_tokens`,
`input_tokens`, and `output_tokens`. Report each as a percentage of the
total. Also report the context size on the first turn and on the last turn.

## Output format

One table, sorted by cost, highest first:

| FINDING | SEVERITY | EVIDENCE | WHAT IT IS COSTING ME |
| --- | --- | --- | --- |

- Severity is RED, AMBER, or GREEN.
- Evidence is a number or a file path — never an adjective.

Then one final line: the single highest-leverage change to make. One line,
nothing else.

# Training4me

A full-stack training-schedule app that generates a complete training period
(mesocycle) from one input: **how many days per week you can train**.

**Training philosophy:** Magnus Samuelsson's strength base — heavy, simple,
barbell-first, built over years, never to injury — fused with Marcus Filly's
Functional Bodybuilding *"look good, move well"* layer: primers, tempo,
unilateral work, structural balance, and aerobic base so the strength doesn't
turn into stiffness.

**Hard product constraints**
- Every session fits inside **60 minutes**, verified by a time-budget engine, not by guesswork.
- Only **simple, learnable movements**. No skill-gated lifts unless the user opts in.
- **Material Design 3** UI, kept deliberately plain.
- The **main part is big as hell**: the heavy compound is the centre of every session.

---

## This repository currently contains the build plan, not the app

The app is meant to be built by running the chunk prompts in `docs/chunks/`
one at a time in separate Claude Code (Sonnet) sessions.

**Start here → [`docs/RUNBOOK.md`](docs/RUNBOOK.md)**

| Document | What it is |
|---|---|
| [`docs/00-CONTEXT.md`](docs/00-CONTEXT.md) | Read-first context. Every chunk session starts by reading this file. |
| [`docs/01-METHODOLOGY.md`](docs/01-METHODOLOGY.md) | The training spec: templates, balance rules, progression tables, time budget. |
| [`docs/02-DATA-MODEL.md`](docs/02-DATA-MODEL.md) | Postgres schema, RLS, TypeScript domain types. |
| [`docs/03-ARCHITECTURE.md`](docs/03-ARCHITECTURE.md) | Stack, folder layout, data flow, conventions. |
| [`docs/04-DESIGN-SYSTEM.md`](docs/04-DESIGN-SYSTEM.md) | Material 3 tokens, components, every screen. |
| [`docs/05-ROADMAP.md`](docs/05-ROADMAP.md) | The 13 chunks, dependencies, token budget. |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | How to actually run the chunks without burning tokens. |
| [`docs/chunks/`](docs/chunks/) | 13 paste-ready prompts, one per session. |

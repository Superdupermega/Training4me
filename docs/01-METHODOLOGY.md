# 01 — METHODOLOGY SPEC

This is the training brain, written as implementable rules. Everything here is
deterministic. If a rule reads as an opinion, it is still a rule: implement it
literally, put the number in a constant, and cover it with a test.

Read §§ relevant to your chunk. Do not read the whole file if your chunk only
needs one section.

---

## 1. Principles → code

### 1.1 Magnus Samuelsson layer (the base)

| Principle | Implementation |
|---|---|
| Barbell basics carry the program | Every session has exactly one **T1** lift from the barbell pool. |
| Heavy but submaximal | T1 prescriptions cap at **87% of Training Max** and **RPE 8.5**. The generator may never emit a 1RM attempt, an AMRAP to failure, or an RPE 10 target. |
| Progress over years | Training Max moves at most **+2.5 kg upper / +5 kg lower per mesocycle**, gated by performance (§5.2). No session-to-session load chasing. |
| Never train through pain | A logged pain flag on a movement blacklists that movement for **14 days** and forces a substitution from its `alternatives` list (§4.5). |
| Grip / trunk / carries are training | **≥ 1 loaded carry per week**, always. Carries are a T4 slot, never optional filler. |
| Warm up properly | Mandatory primer block (§3.1) plus ramp sets before T1 (§3.2). Not skippable in generation; skippable at run time by the athlete. |
| Control the eccentric | Default tempo on T2 is `30X1`; T1 default `20X1`. |

### 1.2 Marcus Filly layer (the quality)

| Principle | Implementation |
|---|---|
| Persistence primer | Block A of every session, 6–8 min, aerobic + activation, RPE ≤ 4. |
| Tempo | Every T2 set carries an explicit tempo string, shown in the player. |
| Unilateral | Weekly minimum: **1 unilateral lower + 1 unilateral upper** per 3 training days (§4.4). |
| Structural balance | Weekly pull:push set ratio **1.0–1.4**; hinge:squat **0.8–1.25** (§4.4). |
| Aerobic base | ≥ 4 days/week ⇒ at least one Zone 2 piece of 15–30 min scheduled that week. |
| Supersets | T3 accessories are always paired A1/A2 in a superset to save time (§3.4). |
| Positions before load | Any T2/T3 whose `complexity` is `moderate` gets a cue string rendered in the player. |

### 1.3 Conflict resolution rule

When the layers disagree, resolve in this fixed order:

1. **Safety / longevity wins.** (Both men agree here; this is never overridden.)
2. **The T1 main lift wins.** Time, freshness and priority go to the heavy
   compound. Filly-flavoured work is added around it, never instead of it.
3. **Weekly balance beats session symmetry.** A single session may look
   push-heavy; the *week* must satisfy §4.4.
4. **Trim from the bottom.** When the time budget is exceeded, cut in this order:
   T3 sets → T3 exercises → T4 finisher → T2 sets → primer duration (floor 5 min).
   **Never** cut T1 sets to make a session fit; if T1 alone cannot fit,
   the session cap is too small — surface a config error instead.

---

## 2. Splits: days per week → weekly skeleton

`daysPerWeek` ∈ {2,3,4,5,6}. Each day is assigned a **session archetype**.

| Days | Skeleton | Rationale |
|---|---|---|
| 2 | `FB-A` (Squat main + horizontal pull) · `FB-B` (Hinge main + vertical press) | Two full-body sessions cover all patterns; each session must hit squat OR hinge, one press, one pull. |
| 3 | `FB-A` (Squat) · `FB-B` (Press) · `FB-C` (Hinge) | Classic rotating full-body. Each main pattern gets a dedicated day. |
| 4 | `LOWER-SQ` · `UPPER-PUSH` · `LOWER-HINGE` · `UPPER-PULL` | Upper/lower split; hinge and squat separated by ≥ 48 h. |
| 5 | 4-day skeleton + `AEROBIC-MOBILITY` | Fifth day is Z2 + mobility + carries. Non-negotiable low intensity. |
| 6 | 4-day skeleton + `AEROBIC-MOBILITY` + `PUMP-BALANCE` | Sixth day is T3-only structural balance + arms/shoulders, RPE ≤ 8, zero spinal loading. |

**Day placement** (spacing matters more than which weekday):

| Days | Preferred weekday pattern (Mon=1) | Constraint |
|---|---|---|
| 2 | 1, 4 | ≥ 2 days apart |
| 3 | 1, 3, 5 | ≥ 1 rest day between |
| 4 | 1, 2, 4, 5 | no 3 consecutive loaded days |
| 5 | 1, 2, 3(aerobic), 5, 6 | aerobic day breaks the block |
| 6 | 1, 2, 3, 5, 6, 7(aerobic) | ≤ 3 consecutive, one full rest day |

Rule: **the same main pattern is never trained heavily within 48 hours.**
The generator asserts this and throws if a skeleton violates it.

The user may shift days after generation; shifting must re-run the 48 h check
and warn (not block) on violation.

---

## 3. Session anatomy

Every generated session is an ordered list of **blocks**. Block letters are
shown to the athlete exactly as written.

| Block | Name | Purpose | Typical budget |
|---|---|---|---|
| **A** | Primer | Aerobic + activation | 6–8 min |
| **B** | Main lift (T1) | The big one | 20–26 min inc. ramp |
| **C** | Secondary (T2) | Tempo / unilateral strength | 10–14 min |
| **D** | Accessory superset (T3) | Structural balance, "look good" | 8–12 min |
| **E** | Finisher (T4) | Carry, core, or Z2 | 4–8 min |
| **F** | Down-regulate | Nasal breathing + 1 stretch | 2–3 min |

### 3.1 Block A — Primer (fixed recipes, pick by archetype)

Each recipe is 2 rounds, ~3–4 min per round, RPE ≤ 4, no load or trivial load.

- `LOWER-PRIMER`: 60 s bike/row easy → 8 goblet squat (light) → 8/side 90/90 hip switch → 10 glute bridge
- `UPPER-PRIMER`: 60 s row/ski easy → 10 band pull-apart → 8/side shoulder CAR → 10 scap push-up
- `FULLBODY-PRIMER`: 60 s bike easy → 8 goblet squat → 10 band pull-apart → 6/side world's greatest stretch
- `AEROBIC-PRIMER`: 3 min easy nasal-breathing bike/walk → 8/side hip airplane assisted

### 3.2 Block B — Main lift (T1)

- Ramp sets before working sets: **3 sets** (approx 40%, 60%, 80% of the day's
  working load), 3–5 reps, ~60 s each. Ramp sets are prescribed and displayed
  but never counted as working volume.
- Working prescription comes from the wave table (§5.1).
- Rest: **180 s** (may be 150 s in week 1, 210 s in week 3).
- Tempo: `20X1` unless the movement is a deadlift variant (`21X1`, reset each rep).
- RPE cap 8.5. The player shows "leave 1–2 in the tank" on every T1 set.

### 3.3 Block C — Secondary (T2)

- 1 exercise (2 when `daysPerWeek ≤ 3` and budget allows).
- 3–4 sets × 6–10 reps, tempo `30X1`, rest 90 s.
- Must be **unilateral** or a **different plane** than the T1 of the same day.
- Load target: RPE 7–8, progressed by double progression (§5.3).

### 3.4 Block D — Accessory superset (T3)

- Always a pair: **D1 + D2**, alternating, 3 rounds, rest 45 s after D2 only.
- 10–15 reps, RPE 7–9 (accessories may go close to failure — the main lift may not).
- The pair must be **antagonistic or non-competing** (e.g. face pull + curl,
  hamstring curl + calf raise). Never two exercises loading the same pattern.
- The pair is chosen to close that week's balance deficit (§4.4).

### 3.5 Block E — Finisher (T4)

Rotates weekly in this fixed cycle so nothing is neglected:

1. **Carry** — farmer / suitcase / front-rack, 4 × 30–40 m, rest 60 s
2. **Trunk** — 3 rounds: dead bug 8/side + side plank 30 s/side
3. **Z2** — 6–10 min bike/row/ruck, nasal breathing, RPE 5
4. **Carry** (again — grip gets a double serving, per Magnus)

### 3.6 Block F — Down-regulate

Fixed, 2 min: 8 nasal breaths 4-in/8-out supine, then the day's stretch
(couch stretch on lower days, doorway pec stretch on upper days).

---

## 4. Exercise selection

### 4.1 Movement patterns (the taxonomy — exact string literals)

```
squat | hinge | lunge | push_h | push_v | pull_h | pull_v |
carry | trunk | aerobic | mobility | isolation_upper | isolation_lower
```

### 4.2 Tiers

| Tier | Meaning | Rep range | Examples |
|---|---|---|---|
| `T1` | Heavy barbell base | 3–6 | back squat, front squat, deadlift, trap-bar DL, bench, OHP, barbell row, weighted chin |
| `T2` | Tempo / unilateral strength | 6–10 | DB bench, DB row, split squat, RDL, hip thrust, pull-up, step-up, DB OHP, single-leg RDL |
| `T3` | Structural balance & aesthetics | 10–15 | face pull, curl, triceps pushdown, lateral raise, hamstring curl, calf raise, rear-delt fly, band pull-apart |
| `T4` | Carry / trunk / aerobic | varies | farmer carry, suitcase carry, sled push, dead bug, side plank, pallof press, bike Z2 |

### 4.3 Movement attributes (every library entry carries all of these)

```ts
{
  id: 'back-squat',              // stable slug, never renamed
  name: 'Back Squat',
  pattern: 'squat',
  tier: 'T1',
  equipment: ['barbell', 'rack'],
  complexity: 'simple',          // simple | moderate | advanced
  unilateral: false,
  loadingSecondsPerRep: 4,       // used by the time budget
  defaultTempo: '20X1',
  cue: 'Big air, brace, knees track over toes.',
  alternatives: ['front-squat', 'goblet-squat', 'db-split-squat'],
  contraindications: ['knee', 'lower-back'],   // pain flags that hide it
  aliases: ['knäböj']
}
```

Minimum library size for v1: **70 movements**, at least 6 per pattern,
at least 3 bodyweight-only options per pattern where physically possible.

### 4.4 Weekly balance constraints (HARD — the generator must satisfy all)

Let `sets(pattern)` be working sets in a week (T1+T2+T3, ramp sets excluded).

| # | Constraint | Applies |
|---|---|---|
| B1 | `sets(pull_h)+sets(pull_v) ≥ sets(push_h)+sets(push_v)`, ratio ≤ 1.4 | always |
| B2 | `0.8 ≤ sets(hinge)/sets(squat) ≤ 1.25` | days ≥ 3 |
| B3 | ≥ 1 unilateral lower exercise per 3 training days | always |
| B4 | ≥ 1 unilateral upper exercise per 3 training days | days ≥ 3 |
| B5 | ≥ 1 carry per week | always |
| B6 | ≥ 1 `pull_v` and ≥ 1 `push_v` per week when equipment allows | always |
| B7 | No T1 pattern repeated within 48 h | always |
| B8 | Weekly working sets within the volume band for `daysPerWeek` (§4.6) | always |
| B9 | Every session contains exactly one T1 | except `AEROBIC-MOBILITY`, `PUMP-BALANCE` |
| B10 | No exercise appears more than 2× per week | always |

Implementation: generate → validate → repair (swap/add T3 to close a deficit)
→ re-validate, **max 12 repair iterations**, then throw a typed
`BalanceUnsatisfiableError` naming the failed constraint. Never ship a plan
that silently fails a constraint.

### 4.5 Substitution rules

Substitution is triggered by: missing equipment, a pain flag, an athlete swap,
or constraint repair. Order of preference:

1. Same `pattern`, same `tier`, equipment available
2. Same `pattern`, one tier down, equipment available
3. Explicit entry from the movement's `alternatives` list
4. Bodyweight fallback for that pattern
5. Fail loudly with `NoSubstituteError` (never leave a session incomplete)

A pain flag on `knee` hides every movement with `'knee'` in
`contraindications` for **14 days**, then re-introduces it at **80 % load**.

### 4.6 Weekly volume bands (working sets, T1+T2+T3)

| Days | Total sets/wk | T1 sets/wk | T2 sets/wk | T3 sets/wk |
|---|---|---|---|---|
| 2 | 24–30 | 8–10 | 8–10 | 8–12 |
| 3 | 33–42 | 12–15 | 9–12 | 12–18 |
| 4 | 42–54 | 16–20 | 12–16 | 14–20 |
| 5 | 44–56 | 16–20 | 12–16 | 16–22 |
| 6 | 48–62 | 16–20 | 12–16 | 20–28 |

Experience modifier: `beginner` × 0.8 (round down), `advanced` × 1.1 (round up).

---

## 5. Periodization & progression

### 5.1 Mesocycle waves

Two lengths, user-selectable at onboarding. Percentages are of **Training Max (TM)**.

**4-week (default)**
| Week | T1 prescription | RPE cap | T1 rest | Note |
|---|---|---|---|---|
| 1 | 4 × 5 @ 70 % | 7.0 | 150 s | Groove the pattern |
| 2 | 4 × 5 @ 75 % | 8.0 | 180 s | Add load |
| 3 | 5 × 3 @ 82 %, then 1 × 3 @ 87 % | 8.5 | 210 s | The test set |
| 4 | 2 × 5 @ 60 % | 6.0 | 120 s | Deload: volume −50 %, T3 halved, no T4 carry |

**6-week (two waves)**
| Week | T1 prescription | RPE cap |
|---|---|---|
| 1 | 4 × 6 @ 68 % | 7.0 |
| 2 | 4 × 5 @ 73 % | 7.5 |
| 3 | 5 × 4 @ 78 % | 8.0 |
| 4 | 4 × 4 @ 80 % | 8.0 |
| 5 | 5 × 3 @ 85 %, then 1 × 3 @ 88 % | 8.5 |
| 6 | 2 × 5 @ 60 % | 6.0 (deload) |

Deload week rules (both lengths): T2 sets −1, T3 rounds 3→2, Block E is Z2 only,
primer unchanged, session cap unchanged (sessions simply come in short).

### 5.2 Training Max management

- `TM = e1RM × 0.90`, rounded down to the nearest 2.5 kg.
- If the athlete has no 1RM: onboarding asks for a comfortable set
  (weight × reps at ~RPE 8) and uses **Epley**: `e1RM = w × (1 + reps/30)`,
  then `× 0.95` conservatism factor for the first block.
- End-of-mesocycle adjustment, evaluated on the week-3 (or week-5) top set:

| Outcome | TM change next block |
|---|---|
| All reps completed, logged RPE ≤ 8.0 | **+5 kg** lower / **+2.5 kg** upper |
| All reps, RPE 8.5–9.0 | +2.5 kg lower / +1.25 kg upper |
| All reps, RPE 9.5+ | hold |
| Missed reps | **−5 %**, rounded to 2.5 kg |
| Two consecutive holds | −5 % and force a 6-week wave next block |

### 5.3 Double progression (T2 / T3)

Rep range `[lo, hi]`. When **every** working set of an exercise hits `hi` at
RPE ≤ 8 (T2) / ≤ 9 (T3), increase load next occurrence and reset reps to `lo`:
- Upper-body isolation: **+1.25 kg** (or the smallest available increment)
- Upper compound: **+2.5 kg**
- Lower body: **+5 kg**
- Bodyweight movement: add 1 rep to the top of the range instead, up to `hi + 5`,
  then move to a loaded variant.

### 5.4 Daily autoregulation (readiness)

Before each session the athlete answers three 1–5 sliders: **sleep**,
**soreness** (5 = fresh), **stress** (5 = calm). `readiness = sleep + soreness + stress` (3–15).

| Readiness | T1 load × | Set adjustment | Player message |
|---|---|---|---|
| 13–15 | 1.00 | optional +1 T3 round | "Green light. Go get it." |
| 10–12 | 1.00 | none | "Normal day. Stick to the plan." |
| 7–9 | 0.93 | −1 T2 set | "Back off a touch. Still worth doing." |
| 3–6 | 0.85 | drop Block D, keep A/B/E/F | "Low battery. Move well, get out." |

Readiness never changes the *movements*, only load and volume. It is recorded
so the history view can correlate readiness with performance.

### 5.5 In-session autoregulation

If the athlete logs RPE ≥ 9.5 on any T1 working set, the next set's suggested
load drops 5 % and the player shows a note. If it happens twice, the remaining
T1 sets drop 10 % and the session is flagged `autoregulated: true`.

---

## 6. Time-budget engine (this is what enforces the 60-minute promise)

### 6.1 Tempo → seconds

Tempo is a 4-character string: eccentric / bottom pause / concentric / top pause.
`X` means "as fast as possible" and counts as **1 s**. `A` (isometric hold) counts
as **3 s**. So `30X1` → 3 + 0 + 1 + 1 = **5 s per rep**.

### 6.2 Duration formulas

```
setWork(set)        = reps × secondsPerRep(tempo)     // min 8 s floor per set
setDuration(set)    = setWork(set) + set.restSeconds
exerciseDuration(e) = Σ setDuration + TRANSITION      // TRANSITION = 45 s
supersetDuration(pair, rounds)
                    = rounds × (setWork(A1) + 15 + setWork(A2) + rest) + TRANSITION
blockDuration       = Σ exerciseDuration (or superset formula)
sessionDuration     = Σ blockDuration + FIXED_OVERHEAD  // FIXED_OVERHEAD = 120 s
```

Carries: `setWork = distanceMeters × 1.2 s/m` (loaded walking pace).
Aerobic: `setWork = prescribed durationSeconds` exactly.

### 6.3 Fitting algorithm

```
target = session.capSeconds × 0.95        // 5 % headroom, ~3 min at a 60 min cap
while estimate > target and trimSteps < 20:
    apply the next trim step (§1.3 order)
if estimate > target: throw SessionOverBudgetError(details)
if estimate < target × 0.75: add one T3 round, then one T2 set (max 2 additions)
```

The estimate is stored on the session row (`estimated_seconds`) and displayed
to the athlete as "≈ 52 min" on the plan card. **Every generated session must
carry an estimate ≤ cap; a unit test asserts this over the full matrix of
`daysPerWeek × experience × equipment × week`.**

### 6.4 Calibration

The player records actual elapsed time. After 5 completed sessions the app
computes `actualMedian / estimatedMedian` and stores it as
`user.paceFactor` (clamped 0.8–1.3), applied to future estimates. Slow movers
get shorter sessions automatically.

---

## 7. Equipment profiles

```
full_gym | home_barbell | dumbbells_only | kettlebell_only | minimal_bodyweight
```
Plus individual toggles: `pull_up_bar`, `rack`, `bench`, `bike_or_rower`,
`sled`, `bands`, `dip_station`, `trap_bar`.

An exercise is available iff every entry in its `equipment` array is available.
`home_barbell` without a rack removes back squat → generator substitutes
front squat from the floor or goblet/DB variants via §4.5.

For `minimal_bodyweight`, T1 becomes the hardest available bodyweight variant
(e.g. weighted-vest chin-up, Bulgarian split squat) and progression switches to
**rep progression** rather than load.

---

## 8. Worked example — 3 days/week, full gym, intermediate, week 2

**Day 1 — FB-A (Squat)**  ≈ 56 min
- **A. Primer** — 2 rounds: 60 s bike easy · 8 goblet squat · 8/side 90/90 · 10 glute bridge — *7 min*
- **B. Back Squat** — ramp 3 × 3, then **4 × 5 @ 75 % TM**, tempo 20X1, rest 180 s — *23 min*
- **C. DB Bench Press** — 3 × 8, tempo 30X1, rest 90 s — *11 min*
- **D1. Chest-Supported Row** 3 × 12 / **D2. Face Pull** 3 × 15, rest 45 s — *10 min*
- **E. Farmer Carry** — 4 × 30 m, rest 60 s — *4 min*
- **F. Down-regulate** — 8 nasal breaths + couch stretch — *2 min*

**Day 2 — FB-B (Press)**  ≈ 54 min
- A. Upper primer — *7 min*
- **B. Overhead Press** — ramp, **4 × 5 @ 75 %**, rest 180 s — *22 min*
- **C. Bulgarian Split Squat** — 3 × 8/side, 30X1, rest 90 s — *13 min*
- D1. Chin-up 3 × max-2 / D2. Hamstring Curl 3 × 12 — *9 min*
- E. Dead bug + side plank, 3 rounds — *5 min*
- F. Down-regulate — *2 min*

**Day 3 — FB-C (Hinge)**  ≈ 57 min
- A. Full-body primer — *7 min*
- **B. Trap-Bar Deadlift** — ramp, **4 × 5 @ 75 %**, tempo 21X1, rest 180 s — *24 min*
- **C. Single-Arm DB Row** — 3 × 10/side, 30X1, rest 75 s — *12 min*
- D1. DB Incline Press 3 × 12 / D2. Lateral Raise 3 × 15 — *9 min*
- E. Suitcase Carry 4 × 30 m — *4 min*
- F. Down-regulate — *2 min*

**Weekly balance check**: pull sets 18 / push sets 15 → ratio 1.20 ✅ (B1);
hinge 10 / squat 11 → 0.91 ✅ (B2); unilateral lower ✅ upper ✅; carries 2 ✅;
`pull_v` ✅ `push_v` ✅; T1 patterns squat/push_v/hinge, no repeat within 48 h ✅;
total working sets 38 → inside the 33–42 band ✅.

This example is the fixture for the generator's golden test.

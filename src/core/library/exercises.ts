import type { Exercise, Tier } from '../types';

type Spec = Partial<Exercise> &
  Pick<Exercise, 'id' | 'name' | 'nameSv' | 'pattern' | 'tier' | 'equipment' | 'cue'>;

const REPS: Record<Tier, [number, number]> = { T1: [3, 6], T2: [6, 10], T3: [10, 15], T4: [8, 20] };
const TEMPO: Record<Tier, string> = { T1: '20X1', T2: '30X1', T3: '20X1', T4: '20X1' };

const mk = (s: Spec): Exercise => ({
  complexity: 'simple',
  unilateral: false,
  metric: 'reps',
  loadingSecondsPerRep: 0,
  defaultTempo: TEMPO[s.tier],
  repLo: REPS[s.tier][0],
  repHi: REPS[s.tier][1],
  alternatives: [],
  contraindications: [],
  loadable: true,
  ...s,
});

export const EXERCISES: readonly Exercise[] = [
  // ------------------------------------------------------------------ squat
  mk({ id: 'back-squat', name: 'Back Squat', nameSv: 'Knäböj', pattern: 'squat', tier: 'T1', equipment: ['barbell', 'rack'], cue: 'Big air, brace hard, knees track over toes.', alternatives: ['front-squat', 'goblet-squat', 'db-split-squat'], contraindications: ['knee', 'lower_back'] }),
  mk({ id: 'front-squat', name: 'Front Squat', nameSv: 'Frivändningsböj', pattern: 'squat', tier: 'T1', equipment: ['barbell', 'rack'], complexity: 'moderate', cue: 'Elbows high, stay tall, drive the floor away.', alternatives: ['back-squat', 'goblet-squat', 'kb-front-squat'], contraindications: ['knee', 'wrist'] }),
  mk({ id: 'box-squat', name: 'Box Squat', nameSv: 'Lådböj', pattern: 'squat', tier: 'T1', equipment: ['barbell', 'rack', 'box'], cue: 'Sit back to the box, stay tight, no bouncing.', alternatives: ['back-squat', 'front-squat'], contraindications: ['lower_back'] }),
  mk({ id: 'goblet-squat', name: 'Goblet Squat', nameSv: 'Goblet-böj', pattern: 'squat', tier: 'T2', equipment: ['dumbbell'], cue: 'Bell tight to the chest, elbows inside the knees.', alternatives: ['kb-front-squat', 'tempo-bodyweight-squat', 'back-squat'], contraindications: ['knee'] }),
  mk({ id: 'kb-front-squat', name: 'Kettlebell Front Squat', nameSv: 'Kettlebell frontböj', pattern: 'squat', tier: 'T2', equipment: ['kettlebell'], cue: 'Bells in the rack, ribs down, sit between the hips.', alternatives: ['goblet-squat', 'front-squat'], contraindications: ['knee'] }),
  mk({ id: 'tempo-bodyweight-squat', name: 'Tempo Bodyweight Squat', nameSv: 'Tempoböj', pattern: 'squat', tier: 'T2', equipment: ['none'], repLo: 10, repHi: 20, defaultTempo: '40X1', loadable: false, cue: 'Slow down, full depth, no collapse at the bottom.', alternatives: ['goblet-squat', 'db-split-squat'] }),
  mk({ id: 'heels-elevated-goblet-squat', name: 'Heels-Elevated Goblet Squat', nameSv: 'Goblet-böj med hälstöd', pattern: 'squat', tier: 'T3', equipment: ['dumbbell', 'box'], cue: 'Upright torso, own the bottom position.', alternatives: ['goblet-squat'] }),

  // ------------------------------------------------------------------ hinge
  mk({ id: 'deadlift', name: 'Deadlift', nameSv: 'Marklyft', pattern: 'hinge', tier: 'T1', equipment: ['barbell'], defaultTempo: '21X1', loadingSecondsPerRep: 4.5, cue: 'Wedge in, chest up, push the floor away. Reset each rep.', alternatives: ['trap-bar-deadlift', 'romanian-deadlift', 'kb-swing'], contraindications: ['lower_back'] }),
  mk({ id: 'trap-bar-deadlift', name: 'Trap-Bar Deadlift', nameSv: 'Trap bar-marklyft', pattern: 'hinge', tier: 'T1', equipment: ['trap_bar'], defaultTempo: '21X1', cue: 'Stand up tall, squeeze the glutes at the top.', alternatives: ['deadlift', 'romanian-deadlift', 'db-romanian-deadlift'], contraindications: ['lower_back'] }),
  mk({ id: 'romanian-deadlift', name: 'Romanian Deadlift', nameSv: 'Rumänskt marklyft', pattern: 'hinge', tier: 'T1', equipment: ['barbell'], cue: 'Push the hips back, bar stays against the legs.', alternatives: ['db-romanian-deadlift', 'good-morning', 'trap-bar-deadlift'], contraindications: ['lower_back'] }),
  mk({ id: 'db-romanian-deadlift', name: 'DB Romanian Deadlift', nameSv: 'Hantel-RDL', pattern: 'hinge', tier: 'T2', equipment: ['dumbbell'], cue: 'Long spine, feel the hamstrings load.', alternatives: ['romanian-deadlift', 'single-leg-rdl', 'kb-swing'], contraindications: ['lower_back'] }),
  mk({ id: 'kb-swing', name: 'Kettlebell Swing', nameSv: 'Kettlebellsving', pattern: 'hinge', tier: 'T2', equipment: ['kettlebell'], repLo: 10, repHi: 20, defaultTempo: 'X0X1', complexity: 'moderate', cue: 'Hips snap, arms are ropes. Float, do not lift.', alternatives: ['db-romanian-deadlift', 'glute-bridge'], contraindications: ['lower_back'] }),
  mk({ id: 'hip-thrust', name: 'Hip Thrust', nameSv: 'Höftlyft', pattern: 'hinge', tier: 'T2', equipment: ['barbell', 'bench'], cue: 'Chin tucked, ribs down, full lockout at the top.', alternatives: ['glute-bridge', 'db-romanian-deadlift'] }),
  mk({ id: 'single-leg-rdl', name: 'Single-Leg RDL', nameSv: 'Enbens-RDL', pattern: 'hinge', tier: 'T2', equipment: ['dumbbell'], unilateral: true, complexity: 'moderate', cue: 'Hips square, reach the free leg back like a counterweight.', alternatives: ['db-romanian-deadlift', 'romanian-deadlift'] }),
  mk({ id: 'good-morning', name: 'Good Morning', nameSv: 'God morgon', pattern: 'hinge', tier: 'T2', equipment: ['barbell', 'rack'], complexity: 'moderate', cue: 'Light bar. Hips back, spine long, stop before it rounds.', alternatives: ['romanian-deadlift', 'db-romanian-deadlift'], contraindications: ['lower_back'] }),
  mk({ id: 'glute-bridge', name: 'Glute Bridge', nameSv: 'Höftlyft på golv', pattern: 'hinge', tier: 'T3', equipment: ['none'], loadable: false, cue: 'Heels down, squeeze, pause a beat at the top.', alternatives: ['hip-thrust'] }),
  mk({ id: 'back-extension', name: 'Back Extension', nameSv: 'Ryggresning', pattern: 'hinge', tier: 'T3', equipment: ['bench'], cue: 'Round-free. Squeeze glutes to finish, do not hyperextend.', alternatives: ['glute-bridge', 'bird-dog'], contraindications: ['lower_back'] }),
  mk({ id: 'kb-deadlift', name: 'Kettlebell Deadlift', nameSv: 'Kettlebell-marklyft', pattern: 'hinge', tier: 'T2', equipment: ['kettlebell'], cue: 'Same hinge as a barbell pull, just closer to the floor.', alternatives: ['db-romanian-deadlift', 'trap-bar-deadlift'] }),

  mk({ id: 'single-leg-glute-bridge', name: 'Single-Leg Glute Bridge', nameSv: 'Enbens höftlyft', pattern: 'hinge', tier: 'T2', equipment: ['none'], unilateral: true, repLo: 8, repHi: 15, loadable: false, cue: 'Hips level, drive through the heel, pause at the top.', alternatives: ['glute-bridge', 'single-leg-rdl', 'hip-thrust'] }),
  mk({ id: 'bodyweight-split-squat', name: 'Bodyweight Split Squat', nameSv: 'Delad knäböj kroppsvikt', pattern: 'lunge', tier: 'T2', equipment: ['none'], unilateral: true, repLo: 8, repHi: 15, loadable: false, cue: 'Slow down, back knee kisses the floor.', alternatives: ['db-split-squat', 'reverse-lunge', 'cossack-squat'], contraindications: ['knee'] }),

  // ------------------------------------------------------------------ lunge
  mk({ id: 'db-split-squat', name: 'DB Split Squat', nameSv: 'Delad knäböj', pattern: 'lunge', tier: 'T2', equipment: ['dumbbell'], unilateral: true, cue: 'Back knee straight down, front foot flat.', alternatives: ['bulgarian-split-squat', 'reverse-lunge', 'step-up'], contraindications: ['knee'] }),
  mk({ id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', nameSv: 'Bulgarisk utfallsböj', pattern: 'lunge', tier: 'T2', equipment: ['dumbbell', 'bench'], unilateral: true, complexity: 'moderate', cue: 'Front shin vertical-ish, control the descent.', alternatives: ['db-split-squat', 'reverse-lunge'], contraindications: ['knee'] }),
  mk({ id: 'reverse-lunge', name: 'Reverse Lunge', nameSv: 'Utfall bakåt', pattern: 'lunge', tier: 'T2', equipment: ['dumbbell'], unilateral: true, cue: 'Step back, sink straight down, drive through the front heel.', alternatives: ['db-split-squat', 'walking-lunge'], contraindications: ['knee'] }),
  mk({ id: 'step-up', name: 'Step-Up', nameSv: 'Uppsteg', pattern: 'lunge', tier: 'T2', equipment: ['dumbbell', 'box'], unilateral: true, cue: 'No push off the back foot. All the work is the top leg.', alternatives: ['db-split-squat', 'reverse-lunge'], contraindications: ['knee'] }),
  mk({ id: 'walking-lunge', name: 'Walking Lunge', nameSv: 'Gående utfall', pattern: 'lunge', tier: 'T3', equipment: ['dumbbell'], unilateral: true, cue: 'Tall chest, quiet feet.', alternatives: ['reverse-lunge', 'db-split-squat'], contraindications: ['knee'] }),
  mk({ id: 'cossack-squat', name: 'Cossack Squat', nameSv: 'Kosackböj', pattern: 'lunge', tier: 'T3', equipment: ['none'], unilateral: true, loadable: false, complexity: 'moderate', cue: 'Sit into one hip, other leg straight. Own the range.', alternatives: ['walking-lunge', 'db-split-squat'] }),

  // ------------------------------------------------------------------ push_h
  mk({ id: 'bench-press', name: 'Bench Press', nameSv: 'Bänkpress', pattern: 'push_h', tier: 'T1', equipment: ['barbell', 'bench', 'rack'], cue: 'Shoulder blades pinned, bar to the sternum, leg drive.', alternatives: ['db-bench-press', 'close-grip-bench-press', 'push-up'], contraindications: ['shoulder'] }),
  mk({ id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', nameSv: 'Smalbänk', pattern: 'push_h', tier: 'T1', equipment: ['barbell', 'bench', 'rack'], cue: 'Elbows tucked, index fingers on the rings.', alternatives: ['bench-press', 'db-bench-press'], contraindications: ['elbow'] }),
  mk({ id: 'floor-press', name: 'Floor Press', nameSv: 'Golvpress', pattern: 'push_h', tier: 'T1', equipment: ['barbell'], cue: 'Pause when the triceps touch the floor. No bounce.', alternatives: ['bench-press', 'db-bench-press'], contraindications: ['shoulder'] }),
  mk({ id: 'db-bench-press', name: 'DB Bench Press', nameSv: 'Hantelpress', pattern: 'push_h', tier: 'T2', equipment: ['dumbbell', 'bench'], cue: 'Control the eccentric, stretch at the bottom.', alternatives: ['bench-press', 'push-up', 'db-incline-press'], contraindications: ['shoulder'] }),
  mk({ id: 'db-incline-press', name: 'DB Incline Press', nameSv: 'Lutande hantelpress', pattern: 'push_h', tier: 'T2', equipment: ['dumbbell', 'bench'], cue: 'Low incline, elbows at 45 degrees.', alternatives: ['db-bench-press', 'push-up'], contraindications: ['shoulder'] }),
  mk({ id: 'push-up', name: 'Push-Up', nameSv: 'Armhävning', pattern: 'push_h', tier: 'T2', equipment: ['none'], repLo: 8, repHi: 20, loadable: false, cue: 'One straight line. Chest to the floor, elbows back.', alternatives: ['db-bench-press', 'bench-press'] }),
  mk({ id: 'single-arm-db-floor-press', name: 'Single-Arm DB Floor Press', nameSv: 'Enarms golvpress', pattern: 'push_h', tier: 'T2', equipment: ['dumbbell'], unilateral: true, cue: 'Resist the rotation. Ribs down.', alternatives: ['db-bench-press', 'push-up'] }),
  mk({ id: 'dip', name: 'Dip', nameSv: 'Dips', pattern: 'push_h', tier: 'T2', equipment: ['dip_station'], repLo: 5, repHi: 12, complexity: 'moderate', cue: 'Slight forward lean, stop where the shoulder is comfortable.', alternatives: ['db-bench-press', 'push-up'], contraindications: ['shoulder'] }),
  mk({ regression: true, id: 'band-chest-press', name: 'Band Chest Press', nameSv: 'Bröstpress med band', pattern: 'push_h', tier: 'T3', equipment: ['bands'], cue: 'Squeeze at full extension.', alternatives: ['push-up', 'db-bench-press'] }),

  // ------------------------------------------------------------------ push_v
  mk({ id: 'overhead-press', name: 'Overhead Press', nameSv: 'Militärpress', pattern: 'push_v', tier: 'T1', equipment: ['barbell', 'rack'], cue: 'Squeeze glutes, head through at the top.', alternatives: ['db-shoulder-press', 'push-press', 'kb-overhead-press'], contraindications: ['shoulder', 'lower_back'] }),
  mk({ id: 'push-press', name: 'Push Press', nameSv: 'Stötpress', pattern: 'push_v', tier: 'T1', equipment: ['barbell', 'rack'], complexity: 'moderate', cue: 'Short dip, violent drive, lock it out overhead.', alternatives: ['overhead-press', 'db-shoulder-press'], contraindications: ['shoulder'] }),
  mk({ id: 'db-shoulder-press', name: 'DB Shoulder Press', nameSv: 'Hantelpress över huvud', pattern: 'push_v', tier: 'T2', equipment: ['dumbbell'], cue: 'Ribs down, press slightly forward of the ears.', alternatives: ['overhead-press', 'kb-overhead-press', 'pike-push-up'], contraindications: ['shoulder'] }),
  mk({ id: 'seated-db-press', name: 'Seated DB Press', nameSv: 'Sittande hantelpress', pattern: 'push_v', tier: 'T2', equipment: ['dumbbell', 'bench'], cue: 'Back supported, strict, no leg drive.', alternatives: ['db-shoulder-press', 'overhead-press'], contraindications: ['shoulder'] }),
  mk({ id: 'single-arm-db-press', name: 'Single-Arm DB Press', nameSv: 'Enarmspress', pattern: 'push_v', tier: 'T2', equipment: ['dumbbell'], unilateral: true, cue: 'Do not lean away. Trunk stays stacked.', alternatives: ['db-shoulder-press', 'kb-overhead-press'] }),
  mk({ id: 'kb-overhead-press', name: 'Kettlebell Overhead Press', nameSv: 'Kettlebellpress', pattern: 'push_v', tier: 'T2', equipment: ['kettlebell'], unilateral: true, cue: 'Bell in the rack, press and lock the elbow.', alternatives: ['db-shoulder-press', 'single-arm-db-press'] }),
  mk({ id: 'pike-push-up', name: 'Pike Push-Up', nameSv: 'Pikearmhävning', pattern: 'push_v', tier: 'T2', equipment: ['none'], repLo: 6, repHi: 15, loadable: false, complexity: 'moderate', cue: 'Hips high, crown of the head to the floor.', alternatives: ['db-shoulder-press', 'push-up'], contraindications: ['shoulder'] }),

  // ------------------------------------------------------------------ pull_h
  mk({ id: 'barbell-row', name: 'Barbell Row', nameSv: 'Skivstångsrodd', pattern: 'pull_h', tier: 'T1', equipment: ['barbell'], complexity: 'moderate', cue: 'Torso near parallel, pull to the belly, no heaving.', alternatives: ['single-arm-db-row', 'chest-supported-db-row', 'inverted-row'], contraindications: ['lower_back'] }),
  mk({ id: 'pendlay-row', name: 'Pendlay Row', nameSv: 'Pendlay-rodd', pattern: 'pull_h', tier: 'T1', equipment: ['barbell'], complexity: 'moderate', cue: 'Dead stop each rep, back stays flat.', alternatives: ['barbell-row', 'chest-supported-db-row'], contraindications: ['lower_back'] }),
  mk({ id: 'single-arm-db-row', name: 'Single-Arm DB Row', nameSv: 'Enarmsrodd', pattern: 'pull_h', tier: 'T2', equipment: ['dumbbell', 'bench'], unilateral: true, cue: 'Pull to the hip, let the shoulder blade travel.', alternatives: ['chest-supported-db-row', 'kb-row', 'barbell-row'] }),
  mk({ id: 'chest-supported-db-row', name: 'Chest-Supported Row', nameSv: 'Bröststödd rodd', pattern: 'pull_h', tier: 'T2', equipment: ['dumbbell', 'bench'], cue: 'Chest stays on the pad. No body english.', alternatives: ['single-arm-db-row', 'cable-row', 'inverted-row'] }),
  mk({ id: 'inverted-row', name: 'Inverted Row', nameSv: 'Hängande rodd', pattern: 'pull_h', tier: 'T2', equipment: ['barbell', 'rack'], repLo: 8, repHi: 15, loadable: false, cue: 'Body rigid, chest to the bar.', alternatives: ['chest-supported-db-row', 'band-row'] }),
  mk({ id: 'kb-row', name: 'Kettlebell Row', nameSv: 'Kettlebellrodd', pattern: 'pull_h', tier: 'T2', equipment: ['kettlebell'], unilateral: true, cue: 'Hinge, brace, row to the hip.', alternatives: ['single-arm-db-row', 'chest-supported-db-row'] }),
  mk({ id: 'cable-row', name: 'Seated Cable Row', nameSv: 'Sittande kabelrodd', pattern: 'pull_h', tier: 'T2', equipment: ['cable'], cue: 'Tall chest, drive the elbows past the ribs.', alternatives: ['chest-supported-db-row', 'single-arm-db-row'] }),
  mk({ regression: true, id: 'band-row', name: 'Band Row', nameSv: 'Bandrodd', pattern: 'pull_h', tier: 'T3', equipment: ['bands'], cue: 'Squeeze for a beat at the back.', alternatives: ['inverted-row', 'chest-supported-db-row'] }),
  mk({ id: 'face-pull', name: 'Face Pull', nameSv: 'Face pull', pattern: 'pull_h', tier: 'T3', equipment: ['bands'], repLo: 12, repHi: 20, cue: 'Pull to the forehead, thumbs back, slow return.', alternatives: ['band-row', 'rear-delt-fly'] }),

  // ------------------------------------------------------------------ pull_v
  mk({ id: 'weighted-chin-up', name: 'Weighted Chin-Up', nameSv: 'Viktade chins', pattern: 'pull_v', tier: 'T1', equipment: ['pullup_bar'], complexity: 'moderate', cue: 'Full hang to chin over the bar. No kipping.', alternatives: ['chin-up', 'lat-pulldown', 'pull-up'], contraindications: ['elbow', 'shoulder'] }),
  mk({ id: 'chin-up', name: 'Chin-Up', nameSv: 'Chins', pattern: 'pull_v', tier: 'T2', equipment: ['pullup_bar'], repLo: 4, repHi: 12, loadable: false, cue: 'Underhand grip, chest to the bar.', alternatives: ['pull-up', 'lat-pulldown', 'band-assisted-pull-up'], contraindications: ['elbow'] }),
  mk({ id: 'pull-up', name: 'Pull-Up', nameSv: 'Pull-ups', pattern: 'pull_v', tier: 'T2', equipment: ['pullup_bar'], repLo: 3, repHi: 10, loadable: false, cue: 'Overhand, full range, control the way down.', alternatives: ['chin-up', 'lat-pulldown', 'band-assisted-pull-up'], contraindications: ['shoulder'] }),
  mk({ id: 'lat-pulldown', name: 'Lat Pulldown', nameSv: 'Latsdrag', pattern: 'pull_v', tier: 'T2', equipment: ['cable'], cue: 'Chest up, drive the elbows to the pockets.', alternatives: ['chin-up', 'band-lat-pulldown'] }),
  mk({ regression: true, id: 'band-assisted-pull-up', name: 'Band-Assisted Pull-Up', nameSv: 'Pull-ups med band', pattern: 'pull_v', tier: 'T2', equipment: ['pullup_bar', 'bands'], repLo: 5, repHi: 12, loadable: false, cue: 'Use the least assistance that lets you finish clean.', alternatives: ['chin-up', 'lat-pulldown'] }),
  mk({ regression: true, id: 'negative-pull-up', name: 'Negative Pull-Up', nameSv: 'Negativa pull-ups', pattern: 'pull_v', tier: 'T2', equipment: ['pullup_bar'], repLo: 3, repHi: 6, defaultTempo: '50X1', loadable: false, cue: 'Jump to the top, take five seconds down.', alternatives: ['band-assisted-pull-up', 'lat-pulldown'] }),
  mk({ regression: true, id: 'band-lat-pulldown', name: 'Band Lat Pulldown', nameSv: 'Latsdrag med band', pattern: 'pull_v', tier: 'T3', equipment: ['bands'], cue: 'Long arms, pull from the lats not the hands.', alternatives: ['lat-pulldown', 'band-row'] }),
  mk({ id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', nameSv: 'Raka armar latsdrag', pattern: 'pull_v', tier: 'T3', equipment: ['cable'], cue: 'Elbows locked, sweep the bar to the thighs.', alternatives: ['band-lat-pulldown'] }),

  // ------------------------------------------------------------------ carry
  mk({ id: 'farmer-carry', name: 'Farmer Carry', nameSv: 'Farmergång', pattern: 'carry', tier: 'T4', equipment: ['dumbbell'], metric: 'distance', cue: 'Tall, quiet steps, crush the handles.', alternatives: ['suitcase-carry', 'front-rack-carry', 'trap-bar-carry'] }),
  mk({ id: 'suitcase-carry', name: 'Suitcase Carry', nameSv: 'Resväskegång', pattern: 'carry', tier: 'T4', equipment: ['dumbbell'], unilateral: true, metric: 'distance', cue: 'One side only. Refuse to lean.', alternatives: ['farmer-carry', 'front-rack-carry'] }),
  mk({ id: 'front-rack-carry', name: 'Front Rack Carry', nameSv: 'Frontgång', pattern: 'carry', tier: 'T4', equipment: ['kettlebell'], metric: 'distance', cue: 'Bells on the chest, ribs down, breathe.', alternatives: ['farmer-carry', 'suitcase-carry'] }),
  mk({ id: 'overhead-carry', name: 'Overhead Carry', nameSv: 'Överhuvudgång', pattern: 'carry', tier: 'T4', equipment: ['dumbbell'], metric: 'distance', complexity: 'moderate', cue: 'Elbow locked, biceps by the ear.', alternatives: ['front-rack-carry', 'farmer-carry'], contraindications: ['shoulder'] }),
  mk({ id: 'trap-bar-carry', name: 'Trap-Bar Carry', nameSv: 'Trap bar-gång', pattern: 'carry', tier: 'T4', equipment: ['trap_bar'], metric: 'distance', cue: 'Heavy and short. Grip is the point.', alternatives: ['farmer-carry'] }),
  mk({ id: 'sled-push', name: 'Sled Push', nameSv: 'Slädpush', pattern: 'carry', tier: 'T4', equipment: ['sled'], metric: 'distance', cue: 'Low angle, short choppy steps.', alternatives: ['farmer-carry', 'front-rack-carry'] }),

  // ------------------------------------------------------------------ trunk
  mk({ id: 'dead-bug', name: 'Dead Bug', nameSv: 'Dead bug', pattern: 'trunk', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 6, repHi: 12, loadable: false, cue: 'Low back glued to the floor. Exhale as you reach.', alternatives: ['bird-dog', 'hollow-hold'] }),
  mk({ id: 'side-plank', name: 'Side Plank', nameSv: 'Sidoplanka', pattern: 'trunk', tier: 'T4', equipment: ['none'], unilateral: true, metric: 'duration', loadable: false, cue: 'Stack the hips, push the floor away.', alternatives: ['pallof-press', 'plank'] }),
  mk({ id: 'plank', name: 'Plank', nameSv: 'Planka', pattern: 'trunk', tier: 'T4', equipment: ['none'], metric: 'duration', loadable: false, cue: 'Squeeze glutes, tuck the ribs, breathe.', alternatives: ['hollow-hold', 'dead-bug'] }),
  mk({ id: 'hollow-hold', name: 'Hollow Hold', nameSv: 'Hollow hold', pattern: 'trunk', tier: 'T4', equipment: ['none'], metric: 'duration', loadable: false, complexity: 'moderate', cue: 'Low back pressed down. Lower the legs only as far as you can hold that.', alternatives: ['dead-bug', 'plank'] }),
  mk({ id: 'pallof-press', name: 'Pallof Press', nameSv: 'Pallof press', pattern: 'trunk', tier: 'T4', equipment: ['bands'], unilateral: true, cue: 'Resist the twist. Slow out, slow back.', alternatives: ['side-plank', 'dead-bug'] }),
  mk({ id: 'hanging-knee-raise', name: 'Hanging Knee Raise', nameSv: 'Hängande knälyft', pattern: 'trunk', tier: 'T4', equipment: ['pullup_bar'], repLo: 6, repHi: 15, loadable: false, cue: 'No swing. Curl the pelvis, do not just lift the legs.', alternatives: ['hollow-hold', 'dead-bug'] }),
  mk({ id: 'bird-dog', name: 'Bird Dog', nameSv: 'Bird dog', pattern: 'trunk', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 6, repHi: 12, loadable: false, cue: 'Long from fingertip to heel. Hips do not rotate.', alternatives: ['dead-bug', 'plank'] }),
  mk({ id: 'suitcase-hold', name: 'Suitcase Hold', nameSv: 'Resväskehåll', pattern: 'trunk', tier: 'T4', equipment: ['dumbbell'], unilateral: true, metric: 'duration', cue: 'Stand dead straight while one side tries to bend you.', alternatives: ['side-plank', 'pallof-press'] }),

  // ------------------------------------------------------------------ aerobic
  mk({ id: 'bike-z2', name: 'Easy Bike (Zone 2)', nameSv: 'Lugn cykel', pattern: 'aerobic', tier: 'T4', equipment: ['cardio_machine'], metric: 'duration', loadable: false, cue: 'Nasal breathing. You should be able to hold a conversation.', alternatives: ['row-z2', 'brisk-walk'] }),
  mk({ id: 'row-z2', name: 'Easy Row (Zone 2)', nameSv: 'Lugn rodd', pattern: 'aerobic', tier: 'T4', equipment: ['cardio_machine'], metric: 'duration', loadable: false, cue: 'Long, relaxed strokes. Legs, hips, arms.', alternatives: ['bike-z2', 'brisk-walk'] }),
  mk({ id: 'brisk-walk', name: 'Brisk Walk', nameSv: 'Rask promenad', pattern: 'aerobic', tier: 'T4', equipment: ['none'], metric: 'duration', loadable: false, cue: 'Outside if you can. Nose breathing the whole way.', alternatives: ['bike-z2', 'ruck-walk'] }),
  mk({ id: 'ruck-walk', name: 'Ruck Walk', nameSv: 'Gång med vikt', pattern: 'aerobic', tier: 'T4', equipment: ['none'], metric: 'duration', loadable: false, cue: 'Loaded pack, easy pace, tall posture.', alternatives: ['brisk-walk', 'bike-z2'] }),

  // ------------------------------------------------------------------ mobility
  mk({ id: 'hip-90-90', name: '90/90 Hip Switch', nameSv: '90/90 höftbyte', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 6, repHi: 10, loadable: false, cue: 'Slow and controlled, chest tall.', alternatives: ['worlds-greatest-stretch'] }),
  mk({ id: 'worlds-greatest-stretch', name: "World's Greatest Stretch", nameSv: 'Världens bästa stretch', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 4, repHi: 8, loadable: false, cue: 'Lunge, elbow to instep, then open to the ceiling.', alternatives: ['hip-90-90', 'thoracic-rotation'] }),
  mk({ id: 'couch-stretch', name: 'Couch Stretch', nameSv: 'Soffstretch', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, metric: 'duration', loadable: false, cue: 'Squeeze the glute of the back leg. Breathe out slowly.', alternatives: ['worlds-greatest-stretch'] }),
  mk({ id: 'doorway-pec-stretch', name: 'Doorway Pec Stretch', nameSv: 'Bröststretch i dörr', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, metric: 'duration', loadable: false, cue: 'Ribs down, gentle lean, no shoulder pinch.', alternatives: ['thoracic-rotation'] }),
  mk({ id: 'shoulder-car', name: 'Shoulder CAR', nameSv: 'Axelcirklar', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 3, repHi: 6, loadable: false, cue: 'Biggest slowest circle you own. No cheating with the ribs.', alternatives: ['thoracic-rotation', 'doorway-pec-stretch'] }),
  mk({ id: 'cat-cow', name: 'Cat-Cow', nameSv: 'Katt-ko', pattern: 'mobility', tier: 'T4', equipment: ['none'], repLo: 6, repHi: 12, loadable: false, cue: 'Move one vertebra at a time. Breathe with it.', alternatives: ['thoracic-rotation', 'bird-dog'] }),
  mk({ id: 'thoracic-rotation', name: 'Thoracic Rotation', nameSv: 'Bröstryggsrotation', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 6, repHi: 10, loadable: false, cue: 'Rotate from the ribs, keep the hips still.', alternatives: ['cat-cow', 'worlds-greatest-stretch'] }),
  mk({ id: 'hip-airplane', name: 'Hip Airplane', nameSv: 'Höftflygplan', pattern: 'mobility', tier: 'T4', equipment: ['none'], unilateral: true, repLo: 4, repHi: 8, loadable: false, complexity: 'moderate', cue: 'Hold something for balance. Rotate the hip open and closed.', alternatives: ['hip-90-90'] }),
  mk({ id: 'scap-push-up', name: 'Scap Push-Up', nameSv: 'Skulderbladsarmhävning', pattern: 'mobility', tier: 'T4', equipment: ['none'], repLo: 8, repHi: 15, loadable: false, cue: 'Arms stay straight. Push the floor away, then let the chest sink.', alternatives: ['cat-cow'] }),
  mk({ id: 'band-pull-apart', name: 'Band Pull-Apart', nameSv: 'Banddrag isär', pattern: 'mobility', tier: 'T4', equipment: ['bands'], repLo: 10, repHi: 20, loadable: false, cue: 'Straight arms, squeeze the shoulder blades.', alternatives: ['face-pull', 'scap-push-up'] }),

  // ------------------------------------------------------------- isolation_upper
  mk({ id: 'db-curl', name: 'DB Curl', nameSv: 'Hantelcurl', pattern: 'isolation_upper', tier: 'T3', equipment: ['dumbbell'], cue: 'Elbows pinned, no swinging.', alternatives: ['hammer-curl', 'band-curl'] }),
  mk({ id: 'hammer-curl', name: 'Hammer Curl', nameSv: 'Hammarcurl', pattern: 'isolation_upper', tier: 'T3', equipment: ['dumbbell'], cue: 'Neutral grip, slow down.', alternatives: ['db-curl', 'band-curl'] }),
  mk({ regression: true, id: 'band-curl', name: 'Band Curl', nameSv: 'Bandcurl', pattern: 'isolation_upper', tier: 'T3', equipment: ['bands'], cue: 'Squeeze at the top, resist on the way back.', alternatives: ['db-curl', 'hammer-curl'] }),
  mk({ id: 'triceps-pushdown', name: 'Triceps Pushdown', nameSv: 'Tricepspress', pattern: 'isolation_upper', tier: 'T3', equipment: ['cable'], cue: 'Elbows glued to the ribs.', alternatives: ['overhead-triceps-extension', 'band-triceps-pushdown'] }),
  mk({ regression: true, id: 'band-triceps-pushdown', name: 'Band Triceps Pushdown', nameSv: 'Tricepspress med band', pattern: 'isolation_upper', tier: 'T3', equipment: ['bands'], cue: 'Lock out fully, control the return.', alternatives: ['triceps-pushdown', 'overhead-triceps-extension'] }),
  mk({ id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', nameSv: 'Fransk press', pattern: 'isolation_upper', tier: 'T3', equipment: ['dumbbell'], cue: 'Elbows point forward, big stretch at the bottom.', alternatives: ['triceps-pushdown', 'band-triceps-pushdown'], contraindications: ['elbow'] }),
  mk({ id: 'lateral-raise', name: 'Lateral Raise', nameSv: 'Sidolyft', pattern: 'isolation_upper', tier: 'T3', equipment: ['dumbbell'], repLo: 12, repHi: 20, cue: 'Light. Lead with the elbows, stop at shoulder height.', alternatives: ['rear-delt-fly', 'band-pull-apart'] }),
  mk({ id: 'rear-delt-fly', name: 'Rear Delt Fly', nameSv: 'Omvänd flyes', pattern: 'isolation_upper', tier: 'T3', equipment: ['dumbbell'], repLo: 12, repHi: 20, cue: 'Hinge over, thumbs down, squeeze the rear delts.', alternatives: ['face-pull', 'lateral-raise'] }),
  mk({ id: 'skullcrusher', name: 'Skullcrusher', nameSv: 'Skullcrusher', pattern: 'isolation_upper', tier: 'T3', equipment: ['barbell', 'bench'], cue: 'Bar to the forehead, elbows still.', alternatives: ['overhead-triceps-extension', 'triceps-pushdown'], contraindications: ['elbow'] }),

  // ------------------------------------------------------------- isolation_lower
  mk({ id: 'standing-calf-raise', name: 'Standing Calf Raise', nameSv: 'Vadpress stående', pattern: 'isolation_lower', tier: 'T3', equipment: ['dumbbell'], repLo: 12, repHi: 20, defaultTempo: '30A1', cue: 'Full stretch at the bottom, pause at the top.', alternatives: ['bodyweight-calf-raise'] }),
  mk({ id: 'bodyweight-calf-raise', name: 'Bodyweight Calf Raise', nameSv: 'Vadpress kroppsvikt', pattern: 'isolation_lower', tier: 'T3', equipment: ['none'], repLo: 15, repHi: 25, loadable: false, cue: 'Slow, full range, one leg if it is too easy.', alternatives: ['standing-calf-raise'] }),
  mk({ id: 'tibialis-raise', name: 'Tibialis Raise', nameSv: 'Framsida vadlyft', pattern: 'isolation_lower', tier: 'T3', equipment: ['none'], repLo: 15, repHi: 25, loadable: false, cue: 'Heels against a wall, pull the toes up slowly.', alternatives: ['bodyweight-calf-raise'] }),
  mk({ id: 'banded-hamstring-curl', name: 'Banded Hamstring Curl', nameSv: 'Lårcurl med band', pattern: 'isolation_lower', tier: 'T3', equipment: ['bands'], cue: 'Squeeze the hamstring, resist coming back.', alternatives: ['nordic-curl-eccentric', 'glute-bridge'] }),
  mk({ id: 'nordic-curl-eccentric', name: 'Nordic Curl (Eccentric)', nameSv: 'Nordisk curl', pattern: 'isolation_lower', tier: 'T3', equipment: ['none'], repLo: 4, repHi: 8, defaultTempo: '50X1', loadable: false, complexity: 'moderate', cue: 'Fight the way down as long as you can, hands catch you.', alternatives: ['banded-hamstring-curl', 'glute-bridge'] }),
] as const;

export const BY_ID: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown exercise id: ${id}`);
  return found;
}

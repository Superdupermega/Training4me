import type { Equipment, EquipmentProfile } from '../types';

export const PROFILE_EQUIPMENT: Record<EquipmentProfile, Equipment[]> = {
  // rings/landmine/sandbag/machine/ghd (chunk 16) are deliberately only here:
  // adding them to a smaller profile would change which movements the
  // generator can reach for that profile.
  full_gym: ['barbell', 'rack', 'bench', 'dumbbell', 'kettlebell', 'pullup_bar', 'dip_station', 'bands', 'cardio_machine', 'sled', 'box', 'trap_bar', 'cable', 'none', 'rings', 'landmine', 'sandbag', 'machine', 'ghd'],
  home_barbell: ['barbell', 'rack', 'bench', 'dumbbell', 'pullup_bar', 'bands', 'box', 'none'],
  dumbbells_only: ['dumbbell', 'bench', 'bands', 'box', 'none'],
  kettlebell_only: ['kettlebell', 'bands', 'box', 'none'],
  minimal_bodyweight: ['bands', 'none'],
};

export const PROFILE_LABEL: Record<EquipmentProfile, string> = {
  full_gym: 'Full gym',
  home_barbell: 'Home barbell setup',
  dumbbells_only: 'Dumbbells only',
  kettlebell_only: 'Kettlebells only',
  minimal_bodyweight: 'Bodyweight + bands',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell', rack: 'Squat rack', bench: 'Bench', dumbbell: 'Dumbbells',
  kettlebell: 'Kettlebells', pullup_bar: 'Pull-up bar', dip_station: 'Dip bars',
  bands: 'Resistance bands', cardio_machine: 'Bike / rower', sled: 'Sled',
  box: 'Box or step', trap_bar: 'Trap bar', cable: 'Cable machine', none: 'Bodyweight',
  rings: 'Gymnastic rings', landmine: 'Landmine attachment', sandbag: 'Sandbag',
  machine: 'Gym machines', ghd: 'GHD bench',
};

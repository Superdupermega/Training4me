'use client';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useState } from 'react';
import type { E1rmPoint, CalendarDay, ConsistencySummary, MuscleGroupVolume, WeekBucket } from '@/server/analytics';
import type { Pr } from '@/server/repo';
import { StrengthTab } from './StrengthTab';
import { VolumeTab } from './VolumeTab';
import { ConsistencyTab } from './ConsistencyTab';
import { RecordsTab } from './RecordsTab';

interface Props {
  strength: { exerciseId: string; series: E1rmPoint[] };
  weekly: WeekBucket[];
  byMuscleGroup: MuscleGroupVolume[];
  consistencySummary: ConsistencySummary | null;
  calendar: CalendarDay[];
  paceFactor: number;
  prs: Pr[];
  trainingMaxes: Record<string, number>;
  today: string;
}

const TABS = ['Strength', 'Volume', 'Consistency', 'Records'] as const;

export function AnalysisTabs({
  strength, weekly, byMuscleGroup, consistencySummary, calendar, paceFactor, prs, trainingMaxes, today,
}: Props) {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {TABS.map((label, i) => <Tab key={label} label={label} value={i} />)}
      </Tabs>

      {tab === 0 && (
        <StrengthTab initialExerciseId={strength.exerciseId} initialSeries={strength.series} trainingMaxes={trainingMaxes} />
      )}
      {tab === 1 && <VolumeTab weekly={weekly} byMuscleGroup={byMuscleGroup} />}
      {tab === 2 && (
        <ConsistencyTab summary={consistencySummary} calendar={calendar} paceFactor={paceFactor} today={today} />
      )}
      {tab === 3 && <RecordsTab prs={prs} trainingMaxes={trainingMaxes} />}
    </Box>
  );
}

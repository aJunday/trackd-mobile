/**
 * Smart Split Recommendation Engine
 *
 * Given user's training days/week + goal, recommends the best research-backed split.
 * Used in onboarding (after Goal step) and Profile settings.
 *
 * All recommendations apply Schoenfeld 2017 volume principles (10-20 sets/muscle/week)
 * and Wolf 2025 frequency-2x-per-week principle.
 */

export type Goal = 'lose_fat' | 'maintain' | 'build_muscle';
export type DaysPerWeek = 2 | 3 | 4 | 5 | 6;

export interface SplitDay {
  day_of_week: number; // 0 = Mon, 6 = Sun
  template_id: string; // refs PRESET_TEMPLATES on backend
  template_name: string;
  is_rest?: boolean;
}

export interface SplitRecommendation {
  id: string;
  name: string;
  reasoning: string;       // why we picked this for them
  days_per_week: DaysPerWeek;
  schedule: SplitDay[];    // length 7, 0=Mon..6=Sun
  research_notes: string;  // shown in research badge
}

const REST = (day: number): SplitDay => ({
  day_of_week: day,
  template_id: 'rest',
  template_name: 'Rest',
  is_rest: true,
});

const SPLITS: Record<string, Omit<SplitRecommendation, 'days_per_week'>> = {
  full_body_2: {
    id: 'full_body_2',
    name: 'Full Body Alt (2 days)',
    reasoning: 'With 2 days, full-body sessions hit each muscle 2x/week — research shows 2x frequency is optimal for hypertrophy regardless of split (Schoenfeld 2016).',
    schedule: [
      { day_of_week: 0, template_id: 'preset_fullbody', template_name: 'Full Body A' },
      REST(1), REST(2),
      { day_of_week: 3, template_id: 'preset_fullbody_b', template_name: 'Full Body B' },
      REST(4), REST(5), REST(6),
    ],
    research_notes: 'Schoenfeld 2017 — 2x/week beats 1x; volume drives growth.',
  },
  full_body_3: {
    id: 'full_body_3',
    name: 'Full Body x3',
    reasoning: '3 full-body sessions hit every muscle 3x/week — exceptional for fat loss / maintenance because total weekly volume + calorie burn is maximized.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_fullbody', template_name: 'Full Body A' },
      REST(1),
      { day_of_week: 2, template_id: 'preset_fullbody_b', template_name: 'Full Body B' },
      REST(3),
      { day_of_week: 4, template_id: 'preset_fullbody', template_name: 'Full Body A' },
      REST(5), REST(6),
    ],
    research_notes: '3x/week frequency is the sweet spot for novice & intermediate — Schoenfeld 2016.',
  },
  ppl_3: {
    id: 'ppl_3',
    name: 'Push / Pull / Legs',
    reasoning: 'Classic muscle-gain split. Each muscle hit hard once with full recovery. Best for hypertrophy at 3 days because you can pack 16+ sets per session.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_push', template_name: 'Push' },
      REST(1),
      { day_of_week: 2, template_id: 'preset_pull', template_name: 'Pull' },
      REST(3),
      { day_of_week: 4, template_id: 'preset_legs', template_name: 'Legs' },
      REST(5), REST(6),
    ],
    research_notes: 'Wolf 2025 — high-volume sessions + lengthened-position exercises maximize growth.',
  },
  upper_lower_4: {
    id: 'upper_lower_4',
    name: 'Upper / Lower x2',
    reasoning: 'Each muscle group trained 2x/week — optimal frequency per Schoenfeld 2017 meta. The most evidence-backed split at 4 days for any goal.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_upper', template_name: 'Upper' },
      { day_of_week: 1, template_id: 'preset_lower', template_name: 'Lower' },
      REST(2),
      { day_of_week: 3, template_id: 'preset_upper', template_name: 'Upper' },
      { day_of_week: 4, template_id: 'preset_lower', template_name: 'Lower' },
      REST(5), REST(6),
    ],
    research_notes: 'Schoenfeld 2017 — 2x frequency + Upper/Lower allows highest weekly volume per muscle.',
  },
  ppl_upper_lower_5: {
    id: 'ppl_upper_lower_5',
    name: 'PPL + Upper / Lower',
    reasoning: 'High-volume hypertrophy split for muscle gain. Push + Pull + Legs hit muscles once heavy; Upper + Lower add a 2nd higher-volume hit later in the week.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_push', template_name: 'Push' },
      { day_of_week: 1, template_id: 'preset_pull', template_name: 'Pull' },
      { day_of_week: 2, template_id: 'preset_legs', template_name: 'Legs' },
      REST(3),
      { day_of_week: 4, template_id: 'preset_upper', template_name: 'Upper' },
      { day_of_week: 5, template_id: 'preset_lower', template_name: 'Lower' },
      REST(6),
    ],
    research_notes: 'Schoenfeld 2017 — high-volume PPL + UL hybrid for advanced lifters.',
  },
  full_upper_lower_5: {
    id: 'full_upper_lower_5',
    name: 'Full Body x3 + Upper / Lower',
    reasoning: '3 full-body sessions for weekly volume + Upper/Lower for targeted muscle work. Best fat-loss split at 5 days — calorie burn + muscle preservation.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_fullbody', template_name: 'Full Body A' },
      { day_of_week: 1, template_id: 'preset_upper', template_name: 'Upper' },
      REST(2),
      { day_of_week: 3, template_id: 'preset_fullbody_b', template_name: 'Full Body B' },
      { day_of_week: 4, template_id: 'preset_lower', template_name: 'Lower' },
      { day_of_week: 5, template_id: 'preset_fullbody', template_name: 'Full Body A' },
      REST(6),
    ],
    research_notes: 'Helms 2014 — preserve muscle in deficit with high frequency + adequate volume.',
  },
  ppl_x2_6: {
    id: 'ppl_x2_6',
    name: 'PPL x2 (6 days)',
    reasoning: 'Each muscle hit 2x/week with high-volume sessions. The gold standard for natural hypertrophy at 6 days — Wolf 2025.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_push', template_name: 'Push' },
      { day_of_week: 1, template_id: 'preset_pull', template_name: 'Pull' },
      { day_of_week: 2, template_id: 'preset_legs', template_name: 'Legs' },
      { day_of_week: 3, template_id: 'preset_push', template_name: 'Push' },
      { day_of_week: 4, template_id: 'preset_pull', template_name: 'Pull' },
      { day_of_week: 5, template_id: 'preset_legs', template_name: 'Legs' },
      REST(6),
    ],
    research_notes: 'Wolf 2025 — 2x frequency PPL is the most evidence-backed advanced split.',
  },
  ppl_ul_push_6: {
    id: 'ppl_ul_push_6',
    name: 'PPL + Upper / Lower / Push',
    reasoning: 'High-volume split that biases push/pull frequency 2x — best for fat-loss / maintenance with strength priorities.',
    schedule: [
      { day_of_week: 0, template_id: 'preset_push', template_name: 'Push' },
      { day_of_week: 1, template_id: 'preset_pull', template_name: 'Pull' },
      { day_of_week: 2, template_id: 'preset_legs', template_name: 'Legs' },
      { day_of_week: 3, template_id: 'preset_upper', template_name: 'Upper' },
      { day_of_week: 4, template_id: 'preset_lower', template_name: 'Lower' },
      { day_of_week: 5, template_id: 'preset_push', template_name: 'Push' },
      REST(6),
    ],
    research_notes: 'Schoenfeld 2017 — push frequency 2x + balanced lower body.',
  },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const getDayName = (dow: number) => DAY_NAMES[dow] || '';

export function recommendSplit(days: DaysPerWeek, goal: Goal): SplitRecommendation {
  let key: string;
  if (days === 2) {
    key = 'full_body_2';
  } else if (days === 3) {
    key = goal === 'build_muscle' ? 'ppl_3' : 'full_body_3';
  } else if (days === 4) {
    key = 'upper_lower_4';
  } else if (days === 5) {
    key = goal === 'build_muscle' ? 'ppl_upper_lower_5' : 'full_upper_lower_5';
  } else {
    // 6 days
    key = goal === 'build_muscle' ? 'ppl_x2_6' : 'ppl_ul_push_6';
  }
  const split = SPLITS[key];
  return { ...split, days_per_week: days };
}

export function getAllSplits(days: DaysPerWeek): SplitRecommendation[] {
  // Allow user to browse alternates for their day count
  const candidates: string[] = [];
  if (days === 2) candidates.push('full_body_2');
  else if (days === 3) candidates.push('ppl_3', 'full_body_3');
  else if (days === 4) candidates.push('upper_lower_4');
  else if (days === 5) candidates.push('ppl_upper_lower_5', 'full_upper_lower_5');
  else if (days === 6) candidates.push('ppl_x2_6', 'ppl_ul_push_6');
  return candidates.map((c) => ({ ...SPLITS[c], days_per_week: days }));
}

// Find today's planned workout from a saved split + day-of-week
export function getTodayWorkout(split: SplitRecommendation | null): SplitDay | null {
  if (!split) return null;
  const jsDow = new Date().getDay(); // Sun=0..Sat=6
  // map JS dow → our dow (Mon=0)
  const ourDow = jsDow === 0 ? 6 : jsDow - 1;
  return split.schedule.find((d) => d.day_of_week === ourDow) || null;
}

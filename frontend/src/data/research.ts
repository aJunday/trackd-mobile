// Research papers backing TRACKD's programming + nutrition guidance.
// Shown to users via ScienceBadge component.

export type ResearchKey =
  | 'volume_schoenfeld_2017'
  | 'technique_androulakis_2024'
  | 'lengthened_partials_wolf_2025'
  | 'mechanical_tension_van_every_2025'
  | 'nordic_zhu_2024'
  | 'copenhagen_weldon_2022'
  | 'mifflin_st_jeor'
  | 'protein_morton_2018'
  | 'icmr_nin_2017';

export interface ResearchRef {
  key: ResearchKey;
  title: string;
  authors: string;
  journal: string;
  year: number;
  takeaway: string;
}

export const RESEARCH: Record<ResearchKey, ResearchRef> = {
  volume_schoenfeld_2017: {
    key: 'volume_schoenfeld_2017',
    title: 'Dose–response relationship between weekly resistance training volume and increases in muscle mass',
    authors: 'Schoenfeld BJ, Ogborn D, Krieger JW',
    journal: 'Journal of Sports Sciences',
    year: 2017,
    takeaway: 'Beginners 5–10 sets/muscle/week, intermediates 10–20, advanced 20+. Volume is the primary driver of hypertrophy.',
  },
  technique_androulakis_2024: {
    key: 'technique_androulakis_2024',
    title: 'Resistance training technique recommendations: long muscle lengths, full ROM, controlled tempo',
    authors: 'Androulakis-Korakakis P, Wolf C, Coleman M, Nippard J, Schoenfeld BJ',
    journal: 'Strength & Conditioning Journal',
    year: 2024,
    takeaway: 'Train at long muscle lengths, full ROM, 2–4 sec tempo, leave 1–2 reps in reserve. Failure on last set only.',
  },
  lengthened_partials_wolf_2025: {
    key: 'lengthened_partials_wolf_2025',
    title: 'Lengthened-position partials and exercise selection for hypertrophy',
    authors: 'Wolf C, Nippard J, Schoenfeld BJ',
    journal: 'Sports Medicine',
    year: 2025,
    takeaway: 'Prioritize loaded stretches: incline curl > standing curl, overhead extension > pushdown, RDL > leg curl, deep squat > partial squat.',
  },
  mechanical_tension_van_every_2025: {
    key: 'mechanical_tension_van_every_2025',
    title: 'Mechanical tension as the primary driver of muscle hypertrophy',
    authors: 'Van Every DW, Nippard J, Phillips SM',
    journal: 'European Journal of Applied Physiology',
    year: 2025,
    takeaway: 'Heavy compounds first, then long-length isolations. Pump matters less than tension. Avoid momentum-based movements.',
  },
  nordic_zhu_2024: {
    key: 'nordic_zhu_2024',
    title: 'Nordic hamstring exercise reduces hamstring strain injury risk',
    authors: 'Zhu Y, Zhang J',
    journal: 'British Journal of Sports Medicine',
    year: 2024,
    takeaway: 'Including Nordic curl in every leg session reduces hamstring injury risk by ~50%. Eccentric overload is the mechanism.',
  },
  copenhagen_weldon_2022: {
    key: 'copenhagen_weldon_2022',
    title: 'Copenhagen adduction exercise and groin injury prevention in field-sport athletes',
    authors: 'Weldon A, Duncan MJ, Turner A, et al.',
    journal: 'Sports Medicine',
    year: 2022,
    takeaway: 'Adductor strength is the #1 predictor of groin injury. Copenhagen adduction adds 35% strength in 8 weeks.',
  },
  mifflin_st_jeor: {
    key: 'mifflin_st_jeor',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals',
    authors: 'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO',
    journal: 'American Journal of Clinical Nutrition',
    year: 1990,
    takeaway: 'Most accurate BMR equation for adults. We use it × your activity multiplier to set your daily calorie target.',
  },
  protein_morton_2018: {
    key: 'protein_morton_2018',
    title: 'A systematic review, meta-analysis and meta-regression of protein supplementation on resistance-trained adaptations',
    authors: 'Morton RW, Murphy KT, McKellar SR, et al.',
    journal: 'British Journal of Sports Medicine',
    year: 2018,
    takeaway: '1.6–2.2 g protein per kg bodyweight per day maximizes muscle gain and preservation during cuts. Above 2.2 g shows no extra benefit.',
  },
  icmr_nin_2017: {
    key: 'icmr_nin_2017',
    title: 'Indian Food Composition Tables (IFCT) and Indian Nutrient Databank (INDB)',
    authors: 'ICMR-National Institute of Nutrition; INDB Team',
    journal: 'ICMR-NIN',
    year: 2017,
    takeaway: 'Lab-analyzed macronutrient values for Indian foods. We use these instead of US/EU generics — Roti, Dal, Paneer, Idli, etc.',
  },
};

// Mapping templates / programs → research keys that back them
export const TEMPLATE_RESEARCH: Record<string, ResearchKey[]> = {
  preset_push: ['volume_schoenfeld_2017', 'technique_androulakis_2024', 'lengthened_partials_wolf_2025', 'mechanical_tension_van_every_2025'],
  preset_pull: ['volume_schoenfeld_2017', 'technique_androulakis_2024', 'lengthened_partials_wolf_2025'],
  preset_legs: ['volume_schoenfeld_2017', 'lengthened_partials_wolf_2025', 'nordic_zhu_2024', 'copenhagen_weldon_2022'],
  preset_upper: ['volume_schoenfeld_2017', 'technique_androulakis_2024', 'mechanical_tension_van_every_2025'],
  preset_lower: ['volume_schoenfeld_2017', 'lengthened_partials_wolf_2025', 'nordic_zhu_2024'],
  preset_fullbody: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
  preset_fullbody_b: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
  preset_ppl: ['volume_schoenfeld_2017', 'lengthened_partials_wolf_2025', 'mechanical_tension_van_every_2025'],
};

export const SPORT_PROGRAM_RESEARCH: Record<string, ResearchKey[]> = {
  boxing: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
  soccer: ['nordic_zhu_2024', 'copenhagen_weldon_2022'],
  powerlifting: ['volume_schoenfeld_2017', 'technique_androulakis_2024'],
  calisthenics: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
  basketball: ['nordic_zhu_2024', 'mechanical_tension_van_every_2025'],
  swimming: ['mechanical_tension_van_every_2025'],
  track: ['nordic_zhu_2024', 'mechanical_tension_van_every_2025'],
  mma: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
  general: ['volume_schoenfeld_2017', 'technique_androulakis_2024', 'lengthened_partials_wolf_2025'],
  football: ['nordic_zhu_2024', 'mechanical_tension_van_every_2025'],
  volleyball: ['nordic_zhu_2024', 'mechanical_tension_van_every_2025'],
  hockey: ['mechanical_tension_van_every_2025'],
  baseball: ['mechanical_tension_van_every_2025'],
  rugby: ['nordic_zhu_2024', 'volume_schoenfeld_2017'],
  cycling: ['volume_schoenfeld_2017'],
  gymnastics: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
  golf: ['mechanical_tension_van_every_2025'],
  wrestling: ['volume_schoenfeld_2017', 'mechanical_tension_van_every_2025'],
};

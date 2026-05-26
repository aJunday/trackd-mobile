/**
 * Per-exercise science citations for sport programs.
 *
 * Used by the "Why this exercise?" option on the active workout 3-dot menu.
 * Only shown when the workout was launched from a sport program (programContext != null).
 *
 * Lookup: try program-specific mapping first, then fall back to a generic line.
 */

export interface ExerciseCitation {
  citation: string;        // Author + year + plain language reason
}

// Program ID → normalized lookup table.
// Program IDs from /api/programs (e.g. "soccer_athlete", "boxing_fighter", etc).
// We accept any program ID containing the keyword(s) below.
const PROGRAM_KEYWORDS: Record<string, string[]> = {
  soccer: ['soccer', 'football_soccer'],
  boxing: ['boxing', 'boxer'],
  powerlifting: ['powerlifting', 'powerlift'],
  calisthenics: ['calisthenics', 'bodyweight'],
  swimming: ['swimming', 'swim'],
  mma: ['mma', 'combat'],
  basketball: ['basketball', 'hoops'],
  track: ['track', 'sprint', 'distance_run', 'running'],
  american_football: ['american_football', 'football_nfl', 'nfl', 'gridiron'],
  volleyball: ['volleyball'],
  hockey: ['hockey'],
  baseball: ['baseball', 'softball'],
  rugby: ['rugby'],
  cycling: ['cycling', 'triathlon', 'cyclist'],
  gymnastics: ['gymnastics', 'gymnast'],
  golf: ['golf'],
  wrestling: ['wrestling', 'grappling', 'bjj', 'judo'],
  general: ['general', 'fitness', 'hybrid'],
};

// Normalize exercise name for fuzzy lookup (lowercase, strip qualifiers).
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Substring match — citation key appears within the exercise name (or vice versa).
const matches = (exercise: string, key: string) => {
  const e = norm(exercise);
  const k = norm(key);
  return e.includes(k) || k.includes(e);
};

// ============================================================
// CITATION TABLES (per sport program category)
// Each table: exercise key → citation string.
// ============================================================

const SOCCER: Record<string, string> = {
  'nordic hamstring curl': 'Zhu & Zhang 2024 — reduces hamstring strain risk by up to 51% in soccer players',
  'copenhagen hip adduction': 'Weldon et al 2022 — prevents adductor injuries which account for 15% of all soccer injuries',
  'box jump': 'Ramirez-Campillo et al 2017 — significantly improves sprint speed and jump height in soccer players',
  'bulgarian split squat': 'Weldon et al 2021 — single leg power is the primary focus of professional soccer S&C programs',
  'sled push': 'Weldon et al 2021 — sprint-specific power development used by professional soccer coaches year-round',
  'lateral bound': 'Ramirez-Campillo et al 2017 — lateral plyometrics improve change of direction speed in soccer',
  'single leg hip thrust': 'Weldon et al 2021 — glute strength for sprint power and injury prevention',
};

const BOXING: Record<string, string> = {
  'rotational med ball throw': 'Turner, Baker & Miller 2011 — highest direct transfer to punch velocity of any exercise tested',
  'med ball throw': 'Turner, Baker & Miller 2011 — highest direct transfer to punch velocity of any exercise tested',
  'hang power clean': 'Turner, Baker & Miller 2011 — explosive hip extension transfers directly to punch power',
  'power clean': 'Turner, Baker & Miller 2011 — explosive hip extension transfers directly to punch power',
  'push press': 'Turner, Baker & Miller 2011 — leg drive transfers to jab and cross extension power',
  'neck isometric': 'Davis et al 2018 — neck strength reduces concussion severity and punch impact absorption',
  'pallof press': 'Turner, Baker & Miller 2011 — anti-rotation core stability is the foundation of punch power transfer',
  'heavy bag': 'Davis et al 2018 — direct sport specificity for punch output under fatigue',
  'jump rope': 'Davis et al 2018 — foot speed and aerobic base development specific to boxing demands',
};

const POWERLIFTING: Record<string, string> = {
  'back squat': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — full depth at long muscle lengths maximizes quad and glute development',
  'bench press': 'Van Every, Nippard, Phillips 2025 — mechanical tension through full ROM is the primary driver of hypertrophy',
  'deadlift': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — hip hinge at long muscle lengths maximizes posterior chain development',
  'romanian deadlift': 'Wolf, Nippard, Schoenfeld 2025 — lengthened partial produces equal or greater hypertrophy than full ROM',
  'close grip bench': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — tricep lockout strength is critical for competition bench press',
  'face pull': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — mandatory shoulder health exercise with heavy pressing',
  'ghr': 'Zhu & Zhang 2024 — posterior chain balance protects lower back in heavy deadlift training',
  'glute ham raise': 'Zhu & Zhang 2024 — posterior chain balance protects lower back in heavy deadlift training',
};

const CALISTHENICS: Record<string, string> = {
  'pull-up': 'Calatayud et al 2015 — matches gym exercises for muscle activation when difficulty is progressively increased',
  'pull up': 'Calatayud et al 2015 — matches gym exercises for muscle activation when difficulty is progressively increased',
  'push-up': 'Calatayud et al 2015 — chest activation comparable to bench press at matched effort levels',
  'push up': 'Calatayud et al 2015 — chest activation comparable to bench press at matched effort levels',
  'hollow body hold': 'Maté-Muñoz et al 2014 — isometric core tension is the prerequisite for all advanced calisthenics skills',
  'tuck planche': 'Maté-Muñoz et al 2014 — straight-arm strength requires isometric training at specific joint angles',
  'planche': 'Maté-Muñoz et al 2014 — straight-arm strength requires isometric training at specific joint angles',
  'muscle-up': 'Maté-Muñoz et al 2014 — scapular stability and straight-arm strength are mandatory prerequisites',
  'muscle up': 'Maté-Muñoz et al 2014 — scapular stability and straight-arm strength are mandatory prerequisites',
  'l-sit': 'Maté-Muñoz et al 2014 — hip flexor and core compression strength required for advanced skill development',
  'l sit': 'Maté-Muñoz et al 2014 — hip flexor and core compression strength required for advanced skill development',
  'scapular pull-up': 'Maté-Muñoz et al 2014 — serratus anterior activation is critical for all overhead calisthenics skills',
  'scapular pull up': 'Maté-Muñoz et al 2014 — serratus anterior activation is critical for all overhead calisthenics skills',
};

const SWIMMING: Record<string, string> = {
  'lat pulldown': 'Crowley, Harrison & Lyons 2018 — lat strength is the primary dryland focus for elite swimmers',
  'cable face pull': 'Crowley, Harrison & Lyons 2018 — most common injury prevention priority for competitive swimmers',
  'face pull': 'Crowley, Harrison & Lyons 2018 — most common injury prevention priority for competitive swimmers',
  'single arm cable row': 'Crowley, Harrison & Lyons 2018 — mimics freestyle catch and pull phase for direct transfer',
  'hollow body hold': 'Crowley, Harrison & Lyons 2018 — core stiffness transfers directly to streamline position in water',
  'kneeling cable hip flexion': 'Crowley, Harrison & Lyons 2018 — hip flexor strength improves kick efficiency and reduces knee stress',
  'hip flexion': 'Crowley, Harrison & Lyons 2018 — hip flexor strength improves kick efficiency and reduces knee stress',
  'band pull apart': 'Crowley, Harrison & Lyons 2018 — scapular retraction for shoulder health in high volume swimmers',
};

const MMA: Record<string, string> = {
  'power clean': 'Andreato et al 2017 — explosive hip extension is the primary physical quality for takedowns and strikes',
  'kettlebell swing': 'Andreato et al 2017 — most sport-specific conditioning exercise for MMA — hip hinge mirrors takedown mechanics',
  'farmer carry': 'Andreato et al 2017 — grip strength and postural endurance are critical for grappling performance',
  'farmer walk': 'Andreato et al 2017 — grip strength and postural endurance are critical for grappling performance',
  'neck isometric': 'Andreato et al 2017 — neck strength reduces injury risk from strikes and submission attempts',
  'pendlay row': 'Andreato et al 2017 — pulling strength for clinch control and takedown defense',
  'assault bike': 'Andreato et al 2017 — aerobic and anaerobic hybrid conditioning matches MMA round demands',
};

const BASKETBALL: Record<string, string> = {
  'trap bar deadlift': 'Makaruk et al 2024 — resistance training improves jump power and sprint speed in basketball players',
  'jump squat': 'Ramirez-Campillo et al 2017 — plyometric training significantly improves vertical jump height',
  'lateral bound': 'Ramirez-Campillo et al 2017 — lateral plyometrics improve defensive agility which is a key basketball metric',
  'power clean': 'Weldon et al 2022 — Olympic lifting is standard in NBA S&C programs for explosive hip power',
  'depth drop': 'Ramirez-Campillo et al 2017 — reactive strength for landing and re-jumping in basketball',
  'single leg box jump': 'Ramirez-Campillo et al 2017 — unilateral power for cutting and driving to basket',
};

const TRACK: Record<string, string> = {
  'power clean': 'Loturco et al 2023 — most effective exercise for improving sprint acceleration in track athletes',
  'back squat': 'Loturco et al 2023 — foundation of sprint power development for track athletes',
  'heavy single leg calf raise': 'Loturco et al 2023 — Achilles tendon stiffness directly improves running economy in distance runners',
  'calf raise': 'Loturco et al 2023 — Achilles tendon stiffness directly improves running economy in distance runners',
  'nordic hamstring curl': 'Loturco et al 2023 — most important injury prevention exercise for sprinters',
  'broad jump': 'Loturco et al 2023 — horizontal power development for sprint acceleration',
  'hip flexor': 'Loturco et al 2023 — hip flexor power is critical for sprint mechanics and stride frequency',
};

const AMERICAN_FOOTBALL: Record<string, string> = {
  'power clean': 'Weldon et al 2022 — Olympic lifting is used by 89% of NFL S&C coaches for explosive power development',
  'back squat': 'Weldon et al 2022 — highest absolute strength demands of any team sport require heavy squat training',
  'bench press': 'Weldon et al 2022 — upper body contact strength for pass blocking and tackle breaking',
  'neck isometric': 'Davis et al 2018 — neck strength reduces concussion severity in contact sport athletes',
  'sled sprint': 'Weldon et al 2022 — sprint-specific power development used universally in NFL programs',
  'sled push': 'Weldon et al 2022 — sprint-specific power development used universally in NFL programs',
  'nordic hamstring curl': 'Zhu & Zhang 2024 — hamstring injury prevention in high speed sprint sport athletes',
};

const VOLLEYBALL: Record<string, string> = {
  'jump squat': 'Ramirez-Campillo et al 2017 — plyometric training significantly improves vertical jump in volleyball players',
  'single leg box jump': 'Ramirez-Campillo et al 2017 — approach jump power development for attacking',
  'cable face pull': 'Crowley, Harrison & Lyons 2018 — shoulder health for overhead sport athletes',
  'face pull': 'Crowley, Harrison & Lyons 2018 — shoulder health for overhead sport athletes',
  'lateral bound': 'Ramirez-Campillo et al 2017 — lateral quickness for defensive positioning',
  'overhead press': 'Makaruk et al 2024 — upper body power for spike mechanics',
};

const HOCKEY: Record<string, string> = {
  'copenhagen hip adduction': 'Weldon et al 2022 — groin injury is the most common hockey injury — adductor strengthening is mandatory',
  'lateral squat': 'Weldon et al 2022 — skating stride power development',
  'trap bar deadlift': 'Makaruk et al 2024 — hip extension power for skating acceleration',
  'cable woodchop': 'Turner, Baker & Miller 2011 — rotational power for shot velocity',
  'woodchop': 'Turner, Baker & Miller 2011 — rotational power for shot velocity',
  'lateral bound': 'Ramirez-Campillo et al 2017 — lateral explosive power for skating stride',
};

const BASEBALL: Record<string, string> = {
  'rotational med ball': 'Turner, Baker & Miller 2011 — rotational power has highest transfer to bat speed and pitch velocity',
  'med ball': 'Turner, Baker & Miller 2011 — rotational power has highest transfer to bat speed and pitch velocity',
  'rotator cuff': 'Weldon et al 2022 — shoulder injury prevention is critical in overhead throwing athletes',
  'trap bar deadlift': 'Makaruk et al 2024 — posterior chain power for explosive movements in baseball',
  'single leg squat': 'Weldon et al 2022 — unilateral stability for pitching mechanics and fielding',
};

const RUGBY: Record<string, string> = {
  'back squat': 'Weldon et al 2022 — rugby has highest absolute strength demands alongside American football',
  'bench press': 'Weldon et al 2022 — upper body contact strength for scrummaging and tackling',
  'power clean': 'Weldon et al 2022 — explosive power for lineout jumping and sprint acceleration',
  'neck isometric': 'Davis et al 2018 — neck strength for contact sport collision safety',
  'nordic hamstring curl': 'Zhu & Zhang 2024 — hamstring injury prevention in high speed contact sport',
};

const CYCLING: Record<string, string> = {
  'heavy leg press': 'Huiberts, Wüst, van der Zwaard 2024 — heavy low rep strength minimizes interference with endurance adaptation',
  'leg press': 'Huiberts, Wüst, van der Zwaard 2024 — heavy low rep strength minimizes interference with endurance adaptation',
  'single leg press': 'Huiberts, Wüst, van der Zwaard 2024 — unilateral strength for cycling power output',
  'romanian deadlift': 'Huiberts, Wüst, van der Zwaard 2024 — posterior chain strength for sustained power output',
  'heavy single leg calf raise': 'Loturco et al 2023 — Achilles tendon stiffness improves running economy for triathlon run leg',
  'calf raise': 'Loturco et al 2023 — Achilles tendon stiffness improves running economy for triathlon run leg',
  'hip flexor': 'Huiberts, Wüst, van der Zwaard 2024 — hip flexor strength for cycling cadence efficiency',
};

const GYMNASTICS: Record<string, string> = {
  'scapular pull-up': 'Maté-Muñoz et al 2014 — serratus anterior activation is critical for all overhead gymnastics skills',
  'scapular pull up': 'Maté-Muñoz et al 2014 — serratus anterior activation is critical for all overhead gymnastics skills',
  'hollow body hold': 'Maté-Muñoz et al 2014 — hollow body position is the foundation of all gymnastics movements',
  'l-sit': 'Maté-Muñoz et al 2014 — hip flexor compression strength required for bar and floor skills',
  'l sit': 'Maté-Muñoz et al 2014 — hip flexor compression strength required for bar and floor skills',
  'ring dip': 'Calatayud et al 2015 — ring instability increases muscle activation compared to static surface dips',
  'wrist prep': 'Maté-Muñoz et al 2014 — wrist injury prevention is mandatory before handstand training',
};

const GOLF: Record<string, string> = {
  'cable woodchop': 'Makaruk et al 2024 — rotational power has highest specificity to golf swing mechanics',
  'woodchop': 'Makaruk et al 2024 — rotational power has highest specificity to golf swing mechanics',
  'hip 90/90': 'Makaruk et al 2024 — hip internal rotation is the most limited range of motion in golfers',
  '90/90': 'Makaruk et al 2024 — hip internal rotation is the most limited range of motion in golfers',
  'single leg rdl': 'Makaruk et al 2024 — single leg stability for consistent swing mechanics',
  'pallof press': 'Turner, Baker & Miller 2011 — anti-rotation core for stable swing plane',
  'thoracic extension': 'Makaruk et al 2024 — thoracic mobility is critical for full backswing range',
};

const WRESTLING: Record<string, string> = {
  'power clean': 'Andreato et al 2017 — explosive hip power for takedown execution',
  'farmer carry': 'Andreato et al 2017 — grip strength and postural endurance for extended grappling',
  'farmer walk': 'Andreato et al 2017 — grip strength and postural endurance for extended grappling',
  'neck isometric': 'Andreato et al 2017 — neck strength for defending chokes and pin escapes',
  'heavy row': 'Andreato et al 2017 — pulling strength for clinch and takedown defense',
  'pendlay row': 'Andreato et al 2017 — pulling strength for clinch and takedown defense',
  'barbell row': 'Andreato et al 2017 — pulling strength for clinch and takedown defense',
  'isometric squat': 'Andreato et al 2017 — isometric endurance in wrestling stance position',
};

const GENERAL: Record<string, string> = {
  'goblet squat': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — self-correcting form makes this the best beginner lower body exercise',
  'romanian deadlift': 'Wolf, Nippard, Schoenfeld 2025 — lengthened hamstring position produces superior hypertrophy stimulus',
  'pull-up': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — lat development requires full stretch at top of movement',
  'pull up': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — lat development requires full stretch at top of movement',
  'lat pulldown': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — lat development requires full stretch at top of movement',
  'incline dumbbell curl': 'Wolf, Nippard, Schoenfeld 2025 — shoulder behind torso creates lengthened bicep position for maximum hypertrophy',
  'overhead tricep extension': 'Wolf, Nippard, Schoenfeld 2025 — overhead position fully stretches tricep long head for maximum hypertrophy',
  'overhead extension': 'Wolf, Nippard, Schoenfeld 2025 — overhead position fully stretches tricep long head for maximum hypertrophy',
  'cable lateral raise': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — constant tension through full ROM superior to dumbbell lateral raise',
  'face pull': 'Androulakis-Korakakis, Nippard, Schoenfeld 2024 — posterior deltoid and rotator cuff health mandatory for all pressing movements',
};

const TABLES: Record<string, Record<string, string>> = {
  soccer: SOCCER,
  boxing: BOXING,
  powerlifting: POWERLIFTING,
  calisthenics: CALISTHENICS,
  swimming: SWIMMING,
  mma: MMA,
  basketball: BASKETBALL,
  track: TRACK,
  american_football: AMERICAN_FOOTBALL,
  volleyball: VOLLEYBALL,
  hockey: HOCKEY,
  baseball: BASEBALL,
  rugby: RUGBY,
  cycling: CYCLING,
  gymnastics: GYMNASTICS,
  golf: GOLF,
  wrestling: WRESTLING,
  general: GENERAL,
};

const FALLBACK_CITATION =
  'Makaruk et al 2024 — resistance training improves sport-specific performance across all sports studied';

/**
 * Map an arbitrary program id to a citation category.
 * Returns null if no category matches.
 */
function programCategory(programId?: string | null): string | null {
  if (!programId) return null;
  const p = programId.toLowerCase();
  for (const [cat, keywords] of Object.entries(PROGRAM_KEYWORDS)) {
    if (keywords.some((k) => p.includes(k))) return cat;
  }
  return null;
}

/**
 * Look up the citation for a given exercise inside a program's table.
 * Tries (1) exact match, (2) substring match in either direction,
 * then (3) falls back to GENERAL, then (4) the global fallback citation.
 */
export function getExerciseCitation(
  exerciseName: string,
  programId?: string | null,
): ExerciseCitation {
  if (!exerciseName) return { citation: FALLBACK_CITATION };

  const cat = programCategory(programId);
  const tables: Record<string, string>[] = [];
  if (cat && TABLES[cat]) tables.push(TABLES[cat]);
  // Always allow GENERAL as a secondary lookup (e.g. RDL in a soccer program)
  if (cat !== 'general') tables.push(GENERAL);

  const target = norm(exerciseName);

  // Pass 1: exact normalized match
  for (const table of tables) {
    for (const key of Object.keys(table)) {
      if (norm(key) === target) return { citation: table[key] };
    }
  }
  // Pass 2: substring match
  for (const table of tables) {
    for (const key of Object.keys(table)) {
      if (matches(exerciseName, key)) return { citation: table[key] };
    }
  }

  return { citation: FALLBACK_CITATION };
}

/**
 * Should the "Why this exercise?" option be shown?
 * Yes if the workout originated from a sport program (any non-empty program id).
 */
export function isSportProgram(programId?: string | null): boolean {
  return !!programId && programId.trim().length > 0;
}

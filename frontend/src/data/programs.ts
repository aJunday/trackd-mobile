// TRACKD sport training programs data
// Format: each exercise is [name, sets, reps, rest, cue?]
// Rest-day rows use an empty exercises array
// Covers 18 sports × 3 levels with sport-specific programming.

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  cue?: string;
}
export interface DayPlan {
  day: string;       // "Mon", "Tue", etc. or "Rest"
  focus: string;
  exercises: Exercise[];
}
export interface Program {
  level: Level;
  duration_weeks: number;
  sessions_per_week: number;
  goal: string;
  research_backed: boolean;
  weekly: DayPlan[];
}
export interface Sport {
  id: string;
  name: string;
  emoji: string;
  category: 'strength' | 'endurance' | 'team' | 'combat' | 'skill' | 'general';
  blurb: string;
  programs: Record<Level, Program>;
}

const REST: DayPlan = { day: 'Rest', focus: 'Recovery', exercises: [] };

// Helper to build an exercise quickly
const ex = (name: string, sets: number, reps: string, rest: string, cue?: string): Exercise => ({
  name, sets, reps, rest, cue,
});

// ============================================================
// BOXING
// ============================================================
const BOXING: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3,
    goal: 'Build foundational punch mechanics and conditioning',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Strength & Power', exercises: [
        ex('Medicine Ball Rotational Throw', 3, '8 each side', '60s', 'Power from hips, not arms'),
        ex('Push-Up', 3, '10-15', '60s', 'Chest to floor, full extension, hollow body'),
        ex('Goblet Squat', 3, '12', '60s', 'Upright torso, knees track toes'),
        ex('Dumbbell Row', 3, '10 each side', '60s', 'Elbow drives back, full lat stretch at bottom'),
        ex('Plank', 3, '30s', '45s', 'Neutral spine, squeeze glutes'),
        ex('Jump Rope', 1, '10 min moderate', '—', 'Stay light on balls of feet'),
      ]},
      REST,
      { day: 'Wed', focus: 'Conditioning & Core', exercises: [
        ex('Medicine Ball Slam', 4, '10', '45s', 'Full extension overhead, slam through floor'),
        ex('Band Woodchop (low to high)', 3, '10 each side', '45s', 'Rotate from hips, not arms'),
        ex('Dead Bug', 3, '8 each side', '45s', 'Lower back pressed to floor throughout'),
        ex('Pallof Press', 3, '10 each side', '45s', 'No trunk rotation'),
        ex('Heavy Bag Rounds', 4, '2 min rounds', '60s between', 'Technique first, then volume'),
      ]},
      REST,
      { day: 'Fri', focus: 'Full Body & Footwork', exercises: [
        ex('Box Jump (step down)', 3, '6', '90s', 'Explosive takeoff, land softly, step down'),
        ex('Romanian Deadlift', 3, '12', '60s', 'Hinge at hips, feel hamstring stretch'),
        ex('Push Press (light DB)', 3, '8', '60s', 'Use leg drive, lock out overhead'),
        ex('Lateral Shuffle Bounds', 4, '10m each direction', '45s', 'Stay low, push off outside foot'),
        ex('Shadow Boxing', 3, '2 min', '45s', 'Head movement, stay relaxed'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Increase power output, pad work timing, anaerobic capacity',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Power / Strength', exercises: [
        ex('Hang Clean', 4, '4', '120s', 'Triple extension, shrug hard'),
        ex('Bench Press', 4, '6', '120s', 'Scapula retracted, slight arch'),
        ex('Chin-Up', 4, '6-8', '90s', 'Drive elbows down, pause at top'),
        ex('Bulgarian Split Squat', 3, '8 each', '75s', 'Front heel drives, torso vertical'),
        ex('Med Ball Rotational Throw', 4, '5 each side', '60s', 'All-out intent every rep'),
      ]},
      { day: 'Tue', focus: 'Pads & Footwork', exercises: [
        ex('Skipping Warm-up', 1, '6 min', '—'),
        ex('Pad Work Rounds', 6, '3 min', '60s', 'Snap shots, return to guard'),
        ex('Double-End Bag', 3, '2 min', '60s', 'Track the bag, punch through it'),
        ex('Core Circuit (V-ups, Russian Twists, Plank)', 3, '30s each', '45s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Conditioning', exercises: [
        ex('Heavy Bag Rounds', 8, '3 min', '60s', 'Combos 3-5 punches'),
        ex('Tabata Burpees', 1, '4 min (20/10)', '—', 'Chest to floor each rep'),
        ex('Med Ball Slam', 4, '10', '45s'),
      ]},
      REST,
      { day: 'Sat', focus: 'Sparring / Technical', exercises: [
        ex('Shadow Boxing', 3, '3 min', '60s', 'Visualize an opponent'),
        ex('Light Sparring', 4, '3 min rounds', '90s', 'Controlled, pick 1-2 combos'),
        ex('Neck + Rotator Cuff Work', 3, '12 each', '45s'),
      ]},
      REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 5,
    goal: 'Peak for competition — max strength, anaerobic power, sparring load',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Max Strength', exercises: [
        ex('Trap Bar Deadlift', 5, '3', '180s', 'Brutal intent, don\'t grind'),
        ex('Bench Press', 5, '3', '180s'),
        ex('Pull-Up (weighted)', 4, '5', '120s'),
        ex('Hanging Leg Raise', 4, '8', '60s'),
      ]},
      { day: 'Tue', focus: 'Pads + Sparring', exercises: [
        ex('Warm-up + Shadow', 1, '10 min', '—'),
        ex('Pads (coach-led combos)', 6, '3 min', '60s'),
        ex('Sparring', 4, '3 min rounds', '90s', 'Game-plan focus'),
      ]},
      { day: 'Wed', focus: 'Power', exercises: [
        ex('Power Clean', 6, '2', '150s', 'Speed above all'),
        ex('Push Press', 5, '4', '120s'),
        ex('Depth Jump', 4, '5', '90s', 'Rebound instantly'),
        ex('Med Ball Rotational Throw (heavy)', 5, '4 each side', '90s'),
      ]},
      { day: 'Thu', focus: 'Conditioning', exercises: [
        ex('Bike Intervals', 8, '30s on / 30s off', '—', 'All-out'),
        ex('Heavy Bag Flurries', 10, '20s all-out / 40s jog', '—'),
        ex('Core Circuit', 3, '45s each', '30s'),
      ]},
      REST,
      { day: 'Sat', focus: 'Spar + Skill', exercises: [
        ex('Sparring', 6, '3 min rounds', '90s'),
        ex('Footwork Drills', 4, '90s', '60s'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// CALISTHENICS
// ============================================================
const CALISTHENICS: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 12, sessions_per_week: 3,
    goal: 'Build body-weight strength and proper movement patterns',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Full Body Foundation', exercises: [
        ex('Push-Up Progression', 4, '8-15', '90s', 'Progress from wall → incline → standard → decline'),
        ex('Pull-Up or Row Progression', 4, '5-10', '120s', 'Depress scapula first, then pull'),
        ex('Hollow Body Hold', 4, '10-30s', '60s', 'Lower back glued to floor, ribs down'),
        ex('Squat Progression', 3, '10-15', '60s', 'Progress from box → BW → jump squat'),
        ex('Dip Progression', 3, '6-12', '90s', 'Slight forward lean for chest'),
      ]},
      REST,
      { day: 'Wed', focus: 'Full Body Foundation', exercises: [
        ex('Push-Up Progression', 4, '8-15', '90s'),
        ex('Pull-Up or Row Progression', 4, '5-10', '120s'),
        ex('Hollow Body Hold', 4, '10-30s', '60s'),
        ex('Squat Progression', 3, '10-15', '60s'),
        ex('Dip Progression', 3, '6-12', '90s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Full Body Foundation', exercises: [
        ex('Push-Up Progression', 4, '8-15', '90s'),
        ex('Pull-Up or Row Progression', 4, '5-10', '120s'),
        ex('Hollow Body Hold', 4, '10-30s', '60s'),
        ex('Pistol Squat Progression', 3, '5 each', '90s', 'Start with box pistols'),
        ex('L-sit Progression', 3, '10-20s', '90s'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 12, sessions_per_week: 4,
    goal: 'Unlock muscle-ups, handstands, pistols, advanced core',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Push Focus', exercises: [
        ex('Handstand Practice (wall)', 4, '30-60s', '90s', 'Flat back, tight squeeze'),
        ex('Pseudo Planche Push-Up', 4, '6-10', '90s', 'Hands at hips, lean forward'),
        ex('Ring / Bar Dip', 4, '8-12', '90s'),
        ex('Diamond Push-Up', 3, 'AMRAP', '60s'),
      ]},
      { day: 'Tue', focus: 'Pull Focus', exercises: [
        ex('Archer Pull-Up', 4, '3-5 each', '120s', 'Lower arm stays bent'),
        ex('Front Lever Tuck Hold', 4, '10-20s', '90s'),
        ex('Australian Row (feet elevated)', 4, '10-12', '90s'),
        ex('Hollow → Arch Swings', 3, '10', '60s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Legs / Core', exercises: [
        ex('Pistol Squat', 4, '5 each', '90s'),
        ex('Shrimp Squat Progression', 3, '5 each', '90s'),
        ex('Jump Squat', 4, '10', '60s'),
        ex('Dragon Flag', 4, '5-8', '90s', 'Descend 3 sec'),
        ex('L-Sit', 4, '20s', '75s'),
      ]},
      { day: 'Fri', focus: 'Skill / Muscle-Up', exercises: [
        ex('Explosive Pull-Up', 5, '3', '120s', 'Drive elbows, chest to bar'),
        ex('Muscle-Up Progression', 5, '3-5', '120s'),
        ex('Ring Support Hold', 4, '15-30s', '90s'),
      ]},
      REST, REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 16, sessions_per_week: 5,
    goal: 'Planche, front lever, one-arm chin progressions',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Planche Focus', exercises: [
        ex('Planche Lean', 5, '15-30s', '120s', 'Protract scapula, lean forward'),
        ex('Tuck Planche', 4, '10-20s', '120s'),
        ex('Ring Push-Up', 4, '8-12', '90s'),
        ex('Pseudo Planche Push-Up', 4, '6', '90s'),
      ]},
      { day: 'Tue', focus: 'Front Lever', exercises: [
        ex('Front Lever Tuck → Adv Tuck → Straddle', 5, '10s', '150s', 'Hold the hardest variation you own'),
        ex('Ice-Cream Maker', 4, '6', '120s'),
        ex('Weighted Pull-Up', 5, '4', '150s'),
        ex('L-Sit → V-Sit Progression', 4, '10s', '90s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Legs / Skill', exercises: [
        ex('Shrimp Squat', 4, '5 each', '120s'),
        ex('Bulgarian Split Squat (weighted)', 4, '8 each', '90s'),
        ex('Jump Squat / Box Jump', 5, '5', '90s'),
        ex('Handstand Walk', 5, '10m', '90s'),
      ]},
      { day: 'Fri', focus: 'One-Arm Progressions', exercises: [
        ex('Archer Pull-Up', 5, '5 each', '150s'),
        ex('Typewriter Pull-Up', 4, '3-5 each', '120s'),
        ex('One-Arm Push-Up Progression', 4, '5 each', '120s'),
      ]},
      { day: 'Sat', focus: 'Skill / Mobility', exercises: [
        ex('Handstand Practice', 5, '30-60s', '90s'),
        ex('Wrist / Shoulder Prep', 3, '10', '45s'),
        ex('Hip Mobility Flow', 2, '5 min', '—'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// POWERLIFTING
// ============================================================
const POWERLIFTING: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 12, sessions_per_week: 3,
    goal: 'Linear progression — add weight every session',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Squat Focus', exercises: [
        ex('Back Squat', 3, '5', '180s', 'Brace core, hips back and down, knees track toes, full depth'),
        ex('Romanian Deadlift', 3, '8', '90s', 'Hip hinge, feel hamstring stretch, neutral spine'),
        ex('Leg Press', 3, '10', '90s', 'Knees 90°, push through heels'),
      ]},
      REST,
      { day: 'Wed', focus: 'Bench Focus', exercises: [
        ex('Bench Press', 3, '5', '180s', 'Arch and leg drive, bar to lower chest, full ROM'),
        ex('Close-Grip Bench', 3, '8', '90s', 'Tricep accessory — critical for lockout'),
        ex('Cable Face Pull', 3, '15', '45s', 'Shoulder health — non-negotiable with heavy bench'),
      ]},
      REST,
      { day: 'Fri', focus: 'Deadlift Focus', exercises: [
        ex('Deadlift', 3, '5', '180s', 'Bar over mid-foot, lat tension before you pull'),
        ex('GHR or Nordic Curl', 3, '6', '90s', 'Protect lower back'),
        ex('Weighted Pull-Up', 3, '6', '90s'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 12, sessions_per_week: 4,
    goal: 'Block periodization — accumulation, intensification, realization',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Squat Heavy', exercises: [
        ex('Squat', 5, '3 @ RPE 8', '240s', 'Pause at bottom for drive'),
        ex('Pause Squat', 3, '5', '180s'),
        ex('RDL', 4, '8', '120s'),
        ex('Leg Curl', 3, '12', '75s'),
      ]},
      { day: 'Tue', focus: 'Bench Heavy', exercises: [
        ex('Bench Press', 5, '3 @ RPE 8', '240s'),
        ex('Close-Grip Bench', 4, '6', '120s'),
        ex('DB Row', 4, '8', '90s'),
        ex('Tricep Pushdown', 4, '10', '60s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Squat Volume', exercises: [
        ex('Squat', 4, '6 @ RPE 7', '180s'),
        ex('Front Squat', 3, '5', '150s'),
        ex('Barbell Row', 4, '6', '120s'),
      ]},
      { day: 'Fri', focus: 'Deadlift + Bench Volume', exercises: [
        ex('Deadlift', 4, '4 @ RPE 8', '240s'),
        ex('Bench Press', 4, '6 @ RPE 7', '180s'),
        ex('Pull-Up', 4, '8', '90s'),
        ex('Hanging Leg Raise', 3, '10', '60s'),
      ]},
      REST, REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 16, sessions_per_week: 5,
    goal: 'Meet prep — peak 1RM in squat / bench / deadlift',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Squat Max', exercises: [
        ex('Competition Squat', 6, '2 @ RPE 9', '300s'),
        ex('Pause Squat', 4, '3', '240s'),
        ex('Good Morning', 3, '6', '150s'),
      ]},
      { day: 'Tue', focus: 'Bench Max', exercises: [
        ex('Competition Bench', 6, '2 @ RPE 9', '300s'),
        ex('Spoto Press', 4, '4', '180s'),
        ex('JM Press', 4, '8', '120s'),
      ]},
      { day: 'Wed', focus: 'Pull / Back', exercises: [
        ex('Deficit Deadlift', 4, '3', '240s'),
        ex('Barbell Row', 5, '6', '120s'),
        ex('Lat Pulldown', 4, '10', '90s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Squat + Bench Volume', exercises: [
        ex('Squat', 5, '5 @ RPE 7', '180s'),
        ex('Bench Press', 5, '5 @ RPE 7', '180s'),
        ex('Face Pull', 4, '15', '60s'),
      ]},
      { day: 'Sat', focus: 'Deadlift Heavy', exercises: [
        ex('Competition Deadlift', 5, '2 @ RPE 9', '300s'),
        ex('Block Pulls', 3, '4', '180s'),
        ex('Hanging Leg Raise', 4, '10', '60s'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// SOCCER
// ============================================================
const SOCCER: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3,
    goal: 'Aerobic base, agility, lower-body strength',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Strength + Agility', exercises: [
        ex('Goblet Squat', 3, '10', '60s', 'Knees track toes'),
        ex('Single-Leg RDL', 3, '8 each', '60s', 'Square hips, hinge from hip'),
        ex('Lateral Lunge', 3, '10 each', '60s', 'Push hips back'),
        ex('Ladder Quick Feet', 4, '30s', '30s'),
        ex('Plank Side-Plank Combo', 3, '30s each', '45s'),
      ]},
      REST,
      { day: 'Wed', focus: 'Conditioning + Ball Work', exercises: [
        ex('400m Run', 4, 'repeats', '90s', 'Near 5k pace'),
        ex('Cone Dribbling', 5, '30s', '45s', 'Both feet'),
        ex('Shuttle Run 10-20-10m', 6, '1 rep', '60s'),
        ex('Core Circuit', 3, '45s', '30s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Match-day Sim', exercises: [
        ex('Dynamic Warm-up', 1, '10 min', '—'),
        ex('Small-sided Game', 1, '30 min', '—', 'Focus on first touch'),
        ex('Shooting Drill', 4, '10 shots', '60s'),
        ex('Cool-down Jog', 1, '10 min', '—'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Top-end speed, explosive change of direction, tactical play',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Speed + Power', exercises: [
        ex('Broad Jump', 4, '4', '90s', 'Stick the landing'),
        ex('Trap-Bar Deadlift', 4, '5', '150s'),
        ex('Bulgarian Split Squat', 3, '8 each', '90s'),
        ex('Copenhagen Plank', 3, '30s each', '60s', 'Adductor strength'),
      ]},
      { day: 'Tue', focus: 'Skill + Agility', exercises: [
        ex('Dynamic Warm-up', 1, '12 min', '—'),
        ex('5-10-5 Pro Agility', 6, '1', '90s'),
        ex('Cone Dribble Maze', 5, '30s', '60s'),
        ex('Passing Drill (partner)', 4, '2 min', '45s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Match Intervals', exercises: [
        ex('4x4 Min Intervals @ 90% HRmax', 4, '4 min on / 3 min off', '—'),
        ex('Small-sided 4v4', 1, '20 min', '—'),
      ]},
      REST,
      { day: 'Sat', focus: 'Match / Scrimmage', exercises: [
        ex('Full Match or Scrimmage', 1, '90 min', '—'),
      ]},
      REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 5,
    goal: 'Competition readiness — match endurance + position skill',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Strength', exercises: [
        ex('Back Squat', 5, '4', '180s'),
        ex('Nordic Curl', 4, '6', '120s', 'Hamstring injury prevention'),
        ex('Push Press', 4, '5', '120s'),
        ex('Cable Chop', 3, '10 each', '60s'),
      ]},
      { day: 'Tue', focus: 'Speed + Skill', exercises: [
        ex('Sprint 20m (full recovery)', 8, '1', '120s', 'All-out'),
        ex('Finishing Drill', 5, '6 shots', '60s'),
        ex('Small-sided 3v3', 4, '4 min', '2 min'),
      ]},
      { day: 'Wed', focus: 'Tactical + Tech', exercises: [
        ex('Pattern Play Reps', 6, '8-10 passes', '60s'),
        ex('Crossing + Finishing', 4, '10 reps', '90s'),
        ex('Core Circuit', 3, '45s', '30s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Match Prep', exercises: [
        ex('Activation + Skill', 1, '30 min', '—'),
      ]},
      { day: 'Sat', focus: 'Match Day', exercises: [
        ex('Full Match', 1, '90 min', '—'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// BASKETBALL
// ============================================================
const BASKETBALL: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3,
    goal: 'Vertical jump base, dribbling, shooting mechanics',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Strength + Jump', exercises: [
        ex('Goblet Squat', 4, '8', '75s', 'Deep hips'),
        ex('Box Jump (step down)', 4, '5', '90s', 'Soft landing'),
        ex('Push-Up', 3, '12-15', '60s'),
        ex('Single-Leg Glute Bridge', 3, '10 each', '60s'),
        ex('Plank', 3, '45s', '45s'),
      ]},
      REST,
      { day: 'Wed', focus: 'Ball Handling + Shooting', exercises: [
        ex('Stationary Dribble Drills', 4, '1 min each hand', '45s'),
        ex('Form Shooting (close range)', 4, '15 shots', '45s', 'Elbow under ball'),
        ex('Pull-up Jumper', 3, '10', '60s'),
        ex('Free Throws', 3, '10', '30s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Conditioning + Agility', exercises: [
        ex('Suicide Sprints (17s)', 6, '1', '90s'),
        ex('Defensive Slide', 4, '30s', '45s', 'Stay low, hands active'),
        ex('Lay-Up Lines', 4, '10 each side', '45s'),
        ex('Cool-down Stretch', 1, '8 min', '—'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Explosive vertical, refined shooting, game pace conditioning',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Power + Strength', exercises: [
        ex('Hang Clean', 4, '3', '150s'),
        ex('Back Squat', 4, '5', '150s'),
        ex('Depth Jump', 4, '5', '120s'),
        ex('DB Row', 4, '8', '90s'),
      ]},
      { day: 'Tue', focus: 'Shooting Skill', exercises: [
        ex('Spot Shooting (5 spots)', 5, '10 each', '60s'),
        ex('Off-the-Dribble Jumper', 4, '10', '75s'),
        ex('Catch-and-Shoot', 4, '10', '60s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Ball Handling + Finishing', exercises: [
        ex('2-Ball Dribble Series', 4, '1 min', '60s'),
        ex('Euro-Step Finish', 4, '10', '60s'),
        ex('Transition 3-on-2', 4, '3 min', '90s'),
      ]},
      REST,
      { day: 'Sat', focus: 'Scrimmage', exercises: [
        ex('Full-Court Scrimmage', 1, '40 min', '—'),
        ex('Free Throws (tired)', 3, '10', '30s'),
      ]},
      REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 5,
    goal: 'Peak athleticism, position-specific skill, game sharpness',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Max Power', exercises: [
        ex('Power Clean', 6, '2', '180s'),
        ex('Squat Jump (weighted)', 5, '3', '150s'),
        ex('Bench Press', 4, '5', '150s'),
        ex('Pull-Up (weighted)', 4, '5', '120s'),
      ]},
      { day: 'Tue', focus: 'Shooting Volume', exercises: [
        ex('500 Shot Workout (5 spots x 100)', 1, '500 shots', '—', 'Track make percentage'),
      ]},
      { day: 'Wed', focus: 'Speed + Agility', exercises: [
        ex('Lane Agility Drill', 6, '1', '90s'),
        ex('Zig-Zag Sprint', 5, '20m', '90s'),
        ex('Defensive Closeouts', 5, '30s', '45s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Skill + Finishing', exercises: [
        ex('Iso Breakdowns', 5, '5 moves', '60s'),
        ex('Floaters / Runners', 4, '10', '60s'),
        ex('And-One Finishes', 4, '10', '60s'),
      ]},
      { day: 'Sat', focus: 'Game Simulation', exercises: [
        ex('Full Game (40 min)', 1, '40 min', '—'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// SWIMMING
// ============================================================
const SWIMMING: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3,
    goal: 'Stroke mechanics, breath control, aerobic base',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Technique', exercises: [
        ex('Kickboard Freestyle', 4, '50m', '30s', 'Straight legs, small kick'),
        ex('Catch-Up Drill Freestyle', 4, '50m', '30s', 'One arm at a time'),
        ex('Easy Freestyle', 4, '100m', '30s'),
        ex('Cool-down', 1, '100m any stroke', '—'),
      ]},
      REST,
      { day: 'Wed', focus: 'Endurance', exercises: [
        ex('Warm-up', 1, '200m easy', '—'),
        ex('Freestyle Repeats', 6, '50m', '30s'),
        ex('Breaststroke or Back', 4, '50m', '30s'),
        ex('Cool-down', 1, '100m', '—'),
      ]},
      REST,
      { day: 'Fri', focus: 'Mixed Set', exercises: [
        ex('Freestyle Kick', 4, '50m', '30s'),
        ex('Freestyle Pull (buoy)', 4, '50m', '30s'),
        ex('Full Stroke', 6, '50m', '20s'),
        ex('Cool-down', 1, '200m', '—'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Threshold speed, IM work, race-specific pacing',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Threshold', exercises: [
        ex('Warm-up', 1, '400m', '—'),
        ex('Freestyle Broken 200s', 5, '4x50 on 1:00', '30s'),
        ex('Kick Set', 4, '50m hard', '20s'),
        ex('Cool-down', 1, '200m', '—'),
      ]},
      { day: 'Tue', focus: 'IM Technique', exercises: [
        ex('Warm-up', 1, '300m', '—'),
        ex('100 IM Drill', 4, '100m', '30s', 'Focus on transitions'),
        ex('Stroke Specific', 4, '50m each stroke', '30s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Sprint Speed', exercises: [
        ex('Warm-up', 1, '400m', '—'),
        ex('25m Max Sprint', 8, '1', '60s'),
        ex('50m Descending', 6, '1', '45s', 'Each faster than last'),
        ex('Cool-down', 1, '200m', '—'),
      ]},
      REST,
      { day: 'Sat', focus: 'Distance', exercises: [
        ex('Continuous Freestyle', 1, '1500m steady', '—'),
        ex('Cool-down', 1, '100m', '—'),
      ]},
      REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 6,
    goal: 'Race-peak performance across events',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Aerobic Power', exercises: [
        ex('Warm-up', 1, '600m', '—'),
        ex('10x200 Freestyle', 10, '200m on 2:45', '—'),
        ex('Cool-down', 1, '200m', '—'),
      ]},
      { day: 'Tue', focus: 'Race Pace', exercises: [
        ex('16x50 Race Pace', 16, '50m', '45s'),
        ex('Kick', 8, '50m', '30s'),
      ]},
      { day: 'Wed', focus: 'Stroke / Skill', exercises: [
        ex('Drill → Swim Ladder', 1, '600m', '—'),
        ex('4x100 IM', 4, '100m', '60s'),
      ]},
      { day: 'Thu', focus: 'Threshold', exercises: [
        ex('6x400 Freestyle', 6, '400m', '60s'),
        ex('Cool-down', 1, '200m', '—'),
      ]},
      REST,
      { day: 'Sat', focus: 'Speed', exercises: [
        ex('12x25 All-Out', 12, '25m', '45s'),
        ex('200 Race Simulation', 1, '200m all-out', '—'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// TRACK & FIELD
// ============================================================
const TRACK: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3,
    goal: 'Running economy, stride mechanics, intro to intervals',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Easy', exercises: [
        ex('Easy Run', 1, '20-25 min', '—', 'Conversational pace'),
        ex('Strides', 4, '80m', '60s', 'Smooth acceleration'),
      ]},
      REST,
      { day: 'Wed', focus: 'Intervals', exercises: [
        ex('Warm-up', 1, '10 min jog', '—'),
        ex('200m Repeats', 8, '200m', '200m jog', 'Smooth, controlled'),
        ex('Cool-down', 1, '10 min', '—'),
      ]},
      REST,
      { day: 'Fri', focus: 'Long + Drills', exercises: [
        ex('Easy Long Run', 1, '35-45 min', '—'),
        ex('A-Skip / B-Skip', 3, '20m each', '30s'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Threshold, VO2, event-specific speed',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Easy', exercises: [
        ex('Easy Run', 1, '45 min', '—'),
        ex('Strides', 6, '80m', '60s'),
      ]},
      { day: 'Tue', focus: 'Threshold', exercises: [
        ex('Tempo Run', 1, '3x8 min', '90s jog', 'Comfortably hard'),
      ]},
      REST,
      { day: 'Thu', focus: 'VO2 Intervals', exercises: [
        ex('400m Repeats', 10, '400m', '90s', 'At 5k pace'),
        ex('Cool-down', 1, '10 min', '—'),
      ]},
      { day: 'Fri', focus: 'Long', exercises: [
        ex('Long Run', 1, '75 min', '—'),
      ]},
      REST, REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 6,
    goal: 'Race peak — 1500m through marathon',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Easy', exercises: [
        ex('Easy Run', 1, '60 min', '—'),
      ]},
      { day: 'Tue', focus: 'Threshold', exercises: [
        ex('Threshold', 1, '4x10 min', '2 min jog'),
      ]},
      { day: 'Wed', focus: 'Easy + Strides', exercises: [
        ex('Easy Run', 1, '45 min', '—'),
        ex('Strides', 8, '100m', '60s'),
      ]},
      { day: 'Thu', focus: 'VO2', exercises: [
        ex('1000m Repeats', 6, '1000m', '3 min', 'At 3k pace'),
      ]},
      REST,
      { day: 'Sat', focus: 'Long + Surges', exercises: [
        ex('Long Run w/ surges', 1, '2 hr', '—', 'Last 30 min at MP'),
      ]},
      { day: 'Sun', focus: 'Recovery', exercises: [
        ex('Recovery Run', 1, '30 min', '—'),
      ]},
    ],
  },
};

// ============================================================
// MMA
// ============================================================
const MMA: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Striking + grappling fundamentals, conditioning',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Striking', exercises: [
        ex('Shadow Boxing', 3, '3 min', '60s'),
        ex('Heavy Bag Rounds', 4, '3 min', '60s'),
        ex('Kicks on Pads', 4, '20 each leg', '60s'),
        ex('Plank Circuit', 3, '45s', '30s'),
      ]},
      { day: 'Tue', focus: 'Strength', exercises: [
        ex('Goblet Squat', 3, '10', '75s'),
        ex('Push-Up', 3, 'AMRAP', '60s'),
        ex('Row', 3, '10', '60s'),
        ex('Farmer Carry', 3, '40m', '60s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Grappling Tech', exercises: [
        ex('Shrimp / Hip Escape Drill', 4, '10m', '45s'),
        ex('Mount / Guard Pass Drill', 5, '1 min', '30s'),
        ex('Takedown Reps', 4, '10 per side', '60s'),
      ]},
      { day: 'Fri', focus: 'Conditioning', exercises: [
        ex('Round Robin: Bag / Row / Sprawl', 5, '3 min', '60s'),
        ex('Burpees', 3, '15', '60s'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 12, sessions_per_week: 5,
    goal: 'Integrate striking/grappling, live sparring',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Striking Tech', exercises: [
        ex('Pad Work (combos)', 6, '3 min', '60s'),
        ex('Clinch Work', 4, '2 min', '60s'),
        ex('Kick Drills', 4, '15 each', '45s'),
      ]},
      { day: 'Tue', focus: 'Strength + Power', exercises: [
        ex('Deadlift', 4, '5', '150s'),
        ex('Bench', 4, '6', '120s'),
        ex('Pull-Up', 4, '6', '90s'),
        ex('Turkish Get-Up', 3, '3 each', '90s'),
      ]},
      { day: 'Wed', focus: 'BJJ / Wrestling', exercises: [
        ex('Positional Sparring', 5, '3 min rounds', '60s'),
        ex('Takedown Sparring', 4, '2 min', '90s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Live Striking', exercises: [
        ex('Light Sparring', 5, '3 min rounds', '90s'),
        ex('Bag Flurries', 4, '30s', '30s'),
      ]},
      { day: 'Sat', focus: 'Conditioning', exercises: [
        ex('Bike Intervals', 8, '30s on / 60s off', '—'),
        ex('Core Circuit', 3, '45s', '30s'),
      ]},
      REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 6,
    goal: 'Fight camp — integrate all ranges, peak condition',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Strength', exercises: [
        ex('Clean', 5, '3', '180s'),
        ex('Front Squat', 4, '5', '150s'),
        ex('Weighted Pull-Up', 4, '5', '120s'),
      ]},
      { day: 'Tue', focus: 'Striking Sparring', exercises: [
        ex('Sparring', 6, '3 min', '60s'),
      ]},
      { day: 'Wed', focus: 'Grappling Sparring', exercises: [
        ex('BJJ Rolls', 6, '5 min', '90s'),
      ]},
      { day: 'Thu', focus: 'MMA Sparring', exercises: [
        ex('Full-Range Sparring', 5, '5 min', '90s'),
      ]},
      { day: 'Fri', focus: 'Conditioning', exercises: [
        ex('Hill Sprints', 10, '30s', '60s'),
        ex('Core Circuit', 3, '60s', '30s'),
      ]},
      REST,
      { day: 'Sun', focus: 'Active Recovery', exercises: [
        ex('Yoga Flow', 1, '45 min', '—'),
      ]},
    ],
  },
};

// ============================================================
// GENERAL FITNESS
// ============================================================
const GENERAL: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3,
    goal: 'Build baseline strength and cardio habit',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Full Body', exercises: [
        ex('Goblet Squat', 3, '10', '60s'),
        ex('Push-Up', 3, 'AMRAP', '60s'),
        ex('DB Row', 3, '10 each', '60s'),
        ex('Plank', 3, '30s', '45s'),
        ex('Brisk Walk', 1, '15 min', '—'),
      ]},
      REST,
      { day: 'Wed', focus: 'Full Body', exercises: [
        ex('DB Romanian Deadlift', 3, '10', '60s'),
        ex('DB Bench Press', 3, '10', '60s'),
        ex('Lat Pulldown', 3, '10', '60s'),
        ex('Side Plank', 3, '30s each', '45s'),
        ex('Easy Bike/Walk', 1, '20 min', '—'),
      ]},
      REST,
      { day: 'Fri', focus: 'Full Body', exercises: [
        ex('Split Squat', 3, '8 each', '60s'),
        ex('Incline Push-Up', 3, '12', '60s'),
        ex('Face Pull', 3, '15', '45s'),
        ex('Dead Bug', 3, '10 each', '45s'),
        ex('HIIT Walk', 1, '10 x 1 min on / 1 min off', '—'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4,
    goal: 'Build muscle + cardio capacity',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Upper', exercises: [
        ex('Bench Press', 4, '8', '90s'),
        ex('Row', 4, '8', '90s'),
        ex('OHP', 3, '8', '90s'),
        ex('Pull-Up', 3, '6-10', '90s'),
      ]},
      { day: 'Tue', focus: 'Lower', exercises: [
        ex('Squat', 4, '8', '120s'),
        ex('RDL', 3, '10', '90s'),
        ex('Lunge', 3, '10 each', '75s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Upper', exercises: [
        ex('Incline DB Press', 4, '10', '75s'),
        ex('Lat Pulldown', 4, '10', '75s'),
        ex('Lateral Raise', 3, '12', '60s'),
        ex('Curl + Pushdown Superset', 3, '12', '60s'),
      ]},
      { day: 'Fri', focus: 'Lower + Cardio', exercises: [
        ex('Deadlift', 3, '5', '150s'),
        ex('Leg Press', 3, '10', '90s'),
        ex('Calf Raise', 3, '15', '60s'),
        ex('Zone 2 Cardio', 1, '30 min', '—'),
      ]},
      REST, REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 5,
    goal: 'Performance, body comp, longevity',
    research_backed: true,
    weekly: [
      { day: 'Mon', focus: 'Push', exercises: [
        ex('Bench Press', 5, '5', '120s'),
        ex('Incline DB Press', 4, '8', '90s'),
        ex('Lateral Raise', 4, '12', '60s'),
        ex('Dips', 3, '10', '90s'),
      ]},
      { day: 'Tue', focus: 'Pull', exercises: [
        ex('Deadlift', 4, '5', '180s'),
        ex('Pull-Up', 4, '8', '90s'),
        ex('Barbell Row', 4, '8', '90s'),
        ex('Curl', 3, '12', '60s'),
      ]},
      { day: 'Wed', focus: 'Legs', exercises: [
        ex('Squat', 5, '5', '150s'),
        ex('RDL', 4, '8', '120s'),
        ex('Leg Press', 3, '12', '90s'),
        ex('Calf Raise', 4, '15', '60s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Upper Hypertrophy', exercises: [
        ex('OHP', 4, '6', '120s'),
        ex('Chest-supported Row', 4, '10', '75s'),
        ex('Cable Fly', 3, '12', '60s'),
        ex('Face Pull', 3, '15', '45s'),
      ]},
      { day: 'Sat', focus: 'Zone 2 + Core', exercises: [
        ex('Zone 2 Cardio', 1, '45 min', '—'),
        ex('Core Circuit', 3, '45s', '30s'),
      ]},
      REST,
    ],
  },
};

// ============================================================
// ADAPTIVE but SPORT-SPECIFIC PROGRAMS (9 sports)
// ============================================================

// American Football
const FOOTBALL: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 10, sessions_per_week: 4, research_backed: true,
    goal: 'Build base strength, tackling form, positional conditioning',
    weekly: [
      { day: 'Mon', focus: 'Lower Strength', exercises: [
        ex('Back Squat', 3, '8', '120s', 'Depth and drive — football squats are deep'),
        ex('Power Clean Deadlift', 3, '6', '120s', 'Tight back, explosive pull'),
        ex('Step-Up', 3, '8 each', '75s'),
        ex('Bird Dog', 3, '10 each', '45s'),
      ]},
      { day: 'Tue', focus: 'Upper Strength', exercises: [
        ex('Bench Press', 3, '8', '120s', 'Power-base for line play'),
        ex('Bent-Over Row', 3, '8', '90s'),
        ex('Neck Harness / Towel Neck', 3, '10', '60s', 'Neck strength is injury prevention'),
        ex('Farmer Carry', 3, '30m', '60s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Speed + Position', exercises: [
        ex('10-yard Sprint', 8, '1', '60s', 'Low first 3 steps'),
        ex('Backpedal + Break', 6, '10y', '45s'),
        ex('Blocking Sled / Wall Drive', 4, '10s', '60s'),
      ]},
      { day: 'Fri', focus: 'Conditioning', exercises: [
        ex('Tempo Runs (110y @ 75%)', 8, '1', '60s', 'Build anaerobic capacity'),
        ex('Core Circuit', 3, '45s', '30s'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 12, sessions_per_week: 5, research_backed: true,
    goal: 'Positional power, explosive hits, game-pace conditioning',
    weekly: [
      { day: 'Mon', focus: 'Max Strength Lower', exercises: [
        ex('Trap Bar Deadlift', 5, '3', '180s', 'Intent on each rep'),
        ex('Back Squat', 4, '5', '150s'),
        ex('Glute Ham Raise', 3, '8', '90s'),
      ]},
      { day: 'Tue', focus: 'Speed + Skill', exercises: [
        ex('40-yard Sprint (full recovery)', 6, '1', '180s'),
        ex('Position Drills (route tree / blocking)', 5, '30s', '60s'),
      ]},
      { day: 'Wed', focus: 'Max Strength Upper', exercises: [
        ex('Bench Press', 5, '3', '180s'),
        ex('Weighted Pull-Up', 4, '5', '120s'),
        ex('Push Press', 4, '4', '120s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Power + Agility', exercises: [
        ex('Hang Clean', 5, '3', '150s'),
        ex('Box Jump', 4, '4', '90s'),
        ex('5-10-5 Pro Agility', 6, '1', '90s'),
      ]},
      { day: 'Sat', focus: 'Scrimmage Conditioning', exercises: [
        ex('Gassers (sideline-to-sideline x 4)', 6, '1', '60s'),
      ]},
      REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 14, sessions_per_week: 6, research_backed: true,
    goal: 'Pre-season peak — max power, size, anaerobic capacity',
    weekly: [
      { day: 'Mon', focus: 'Squat Max', exercises: [
        ex('Back Squat', 6, '2 @ RPE 9', '240s'),
        ex('Deficit Deadlift', 4, '3', '180s'),
        ex('Hip Thrust', 4, '6', '120s'),
      ]},
      { day: 'Tue', focus: 'Speed', exercises: [
        ex('Flying 20s', 6, '20y', '180s'),
        ex('Change of Direction Drills', 6, '30s', '90s'),
      ]},
      { day: 'Wed', focus: 'Bench Max', exercises: [
        ex('Bench Press', 6, '2 @ RPE 9', '240s'),
        ex('Incline DB Press', 4, '6', '120s'),
        ex('Weighted Dip', 4, '6', '120s'),
      ]},
      { day: 'Thu', focus: 'Power', exercises: [
        ex('Power Clean', 6, '2', '180s'),
        ex('Depth Jump', 5, '4', '120s'),
        ex('Med Ball Throw', 5, '5', '90s'),
      ]},
      REST,
      { day: 'Sat', focus: 'Scrimmage + Conditioning', exercises: [
        ex('Position Scrimmage', 1, '60 min', '—'),
        ex('Gassers', 6, '1', '60s'),
      ]},
      REST,
    ],
  },
};

// Volleyball
const VOLLEYBALL: Record<Level, Program> = {
  beginner: {
    level: 'beginner', duration_weeks: 8, sessions_per_week: 3, research_backed: true,
    goal: 'Jump base, shoulder durability, passing mechanics',
    weekly: [
      { day: 'Mon', focus: 'Jump + Strength', exercises: [
        ex('Squat Jump', 4, '5', '90s', 'Reach ceiling every rep'),
        ex('Goblet Squat', 3, '10', '60s'),
        ex('Shoulder Y-T-W', 3, '10 each', '45s', 'Rotator cuff prep'),
        ex('Plank', 3, '45s', '45s'),
      ]},
      REST,
      { day: 'Wed', focus: 'Skill', exercises: [
        ex('Passing Triangle', 4, '2 min', '45s'),
        ex('Hitting Approach', 5, '6 reps', '45s', '3-step approach, explosive'),
        ex('Blocking Footwork', 4, '30s', '30s'),
      ]},
      REST,
      { day: 'Fri', focus: 'Power', exercises: [
        ex('Box Jump', 4, '5', '90s'),
        ex('Med Ball Overhead Slam', 4, '8', '60s'),
        ex('Push-Up', 3, 'AMRAP', '60s'),
        ex('Side Plank', 3, '30s each', '45s'),
      ]},
      REST, REST,
    ],
  },
  intermediate: {
    level: 'intermediate', duration_weeks: 10, sessions_per_week: 4, research_backed: true,
    goal: 'Explosive vertical, attack power, defensive footwork',
    weekly: [
      { day: 'Mon', focus: 'Power', exercises: [
        ex('Hang Clean', 4, '3', '150s'),
        ex('Squat Jump (weighted)', 4, '4', '120s'),
        ex('OHP', 4, '6', '90s'),
      ]},
      { day: 'Tue', focus: 'Hitting', exercises: [
        ex('Approach + Swing Reps', 6, '10', '60s'),
        ex('Block Jump + Transition', 5, '5', '60s'),
      ]},
      REST,
      { day: 'Thu', focus: 'Strength', exercises: [
        ex('Back Squat', 4, '5', '150s'),
        ex('RDL', 3, '8', '90s'),
        ex('Pull-Up', 3, '6', '90s'),
      ]},
      { day: 'Sat', focus: 'Scrimmage', exercises: [
        ex('6v6 Scrimmage', 1, '45 min', '—'),
      ]},
      REST, REST,
    ],
  },
  advanced: {
    level: 'advanced', duration_weeks: 12, sessions_per_week: 5, research_backed: true,
    goal: 'Peak vertical, hitting velocity, match endurance',
    weekly: [
      { day: 'Mon', focus: 'Max Power', exercises: [
        ex('Power Clean', 5, '3', '180s'),
        ex('Depth Jump', 4, '5', '120s'),
        ex('Squat', 4, '4', '150s'),
      ]},
      { day: 'Tue', focus: 'Hitting + Jump', exercises: [
        ex('Max Approach Jumps', 6, '5', '90s'),
        ex('Swing Volume', 4, '15 swings', '60s'),
      ]},
      { day: 'Wed', focus: 'Defense + Agility', exercises: [
        ex('Shuffle Sprints', 6, '30s', '60s'),
        ex('Digging Drills', 5, '2 min', '45s'),
      ]},
      { day: 'Thu', focus: 'Strength', exercises: [
        ex('Back Squat', 5, '5', '180s'),
        ex('Weighted Pull-Up', 4, '5', '120s'),
        ex('Hanging Leg Raise', 3, '10', '60s'),
      ]},
      { day: 'Sat', focus: 'Match Play', exercises: [
        ex('Competitive Match', 1, '90 min', '—'),
      ]},
      REST, REST,
    ],
  },
};

// Generic sport-specific template generator for remaining sports
const mkSportProgram = (
  level: Level,
  name: string,
  specific: { day: string; focus: string; exercises: Exercise[] }[],
  weeks: number,
  sessions: number,
  goal: string
): Program => ({
  level, duration_weeks: weeks, sessions_per_week: sessions,
  goal, research_backed: true,
  weekly: specific,
});

// Hockey (ice/field)
const HOCKEY: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Hockey', [
    { day: 'Mon', focus: 'Skating Base', exercises: [
      ex('Lateral Skater Jump', 4, '8 each', '60s', 'Stick the landing sideways'),
      ex('Goblet Squat', 3, '10', '60s', 'Hockey-specific wide stance'),
      ex('Bird Dog', 3, '8 each', '45s'),
      ex('Stick Handling', 4, '2 min', '45s', 'Eyes up'),
    ]},
    REST,
    { day: 'Wed', focus: 'Power', exercises: [
      ex('Broad Jump', 4, '5', '90s', 'Maximal horizontal drive'),
      ex('Split Squat', 3, '10 each', '60s'),
      ex('Push-Up', 3, '12', '60s'),
      ex('Plank', 3, '45s', '45s'),
    ]},
    REST,
    { day: 'Fri', focus: 'Conditioning', exercises: [
      ex('Shift Intervals (30s on / 60s off)', 8, '1', '—', 'Mirror hockey shift length'),
      ex('Shooting Reps', 4, '15 shots', '60s'),
    ]},
    REST, REST,
  ], 8, 3, 'Skating power, shot accuracy, shift conditioning'),
  intermediate: mkSportProgram('intermediate', 'Hockey', [
    { day: 'Mon', focus: 'Strength', exercises: [
      ex('Back Squat', 4, '6', '120s'),
      ex('RDL', 3, '8', '90s'),
      ex('Weighted Pull-Up', 3, '6', '90s'),
    ]},
    { day: 'Tue', focus: 'On-ice Skill', exercises: [
      ex('Power Skating Drills', 5, '2 min', '60s'),
      ex('One-Timer Shots', 5, '10', '60s'),
    ]},
    REST,
    { day: 'Thu', focus: 'Power', exercises: [
      ex('Hang Clean', 4, '3', '150s'),
      ex('Lateral Bound', 4, '6 each', '90s'),
      ex('Med Ball Rotational Throw', 4, '5 each', '60s', 'Shot power generator'),
    ]},
    { day: 'Fri', focus: 'Conditioning', exercises: [
      ex('Bike Intervals', 8, '30s on / 60s off', '—'),
      ex('Core Circuit', 3, '45s', '30s'),
    ]},
    REST, REST,
  ], 10, 4, 'Skating speed, shot power, conditioning for extended shifts'),
  advanced: mkSportProgram('advanced', 'Hockey', [
    { day: 'Mon', focus: 'Max Strength', exercises: [
      ex('Squat', 5, '3 @ RPE 9', '180s'),
      ex('Deadlift', 4, '3', '180s'),
      ex('Bench Press', 4, '5', '150s'),
    ]},
    { day: 'Tue', focus: 'On-ice Power', exercises: [
      ex('Power Skating + Puck', 6, '90s', '60s'),
      ex('Shot Velocity Reps', 5, '8', '60s'),
    ]},
    { day: 'Wed', focus: 'Power', exercises: [
      ex('Power Clean', 5, '3', '180s'),
      ex('Depth Jump to Broad Jump', 4, '4', '120s'),
    ]},
    { day: 'Thu', focus: 'Scrimmage', exercises: [
      ex('Full Ice Scrimmage', 1, '60 min', '—'),
    ]},
    REST,
    { day: 'Sat', focus: 'Conditioning', exercises: [
      ex('Slide-Board Intervals', 10, '30s on / 45s off', '—'),
    ]},
    REST,
  ], 12, 5, 'Peak for season — max skating power + shot velocity'),
};

// Baseball
const BASEBALL: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Baseball', [
    { day: 'Mon', focus: 'Rotational Power', exercises: [
      ex('Med Ball Rotational Throw', 4, '6 each side', '60s', 'Power from hips through core'),
      ex('Goblet Squat', 3, '10', '60s'),
      ex('Push-Up', 3, '10', '60s'),
      ex('Dead Bug', 3, '8 each', '45s'),
    ]},
    REST,
    { day: 'Wed', focus: 'Throwing + Shoulder', exercises: [
      ex('Band Pull-Apart', 3, '15', '45s', 'Scap retraction'),
      ex('External Rotation (band)', 3, '12 each', '45s'),
      ex('Long Toss', 1, '10 min', '—'),
      ex('Tee Swings', 4, '15 swings', '45s'),
    ]},
    REST,
    { day: 'Fri', focus: 'Speed + Defense', exercises: [
      ex('Base Running Sprints', 6, '90ft', '60s'),
      ex('Fielding Reps', 5, '10 grounders', '30s'),
      ex('Plank + Side Plank', 3, '30s each', '45s'),
    ]},
    REST, REST,
  ], 10, 3, 'Rotational power, shoulder health, throwing mechanics'),
  intermediate: mkSportProgram('intermediate', 'Baseball', [
    { day: 'Mon', focus: 'Strength', exercises: [
      ex('Trap-Bar Deadlift', 4, '5', '150s'),
      ex('Goblet Squat', 3, '8', '90s'),
      ex('Bench Press', 3, '6', '120s'),
      ex('Row', 3, '8', '90s'),
    ]},
    { day: 'Tue', focus: 'Rotational Power', exercises: [
      ex('Med Ball Shotput Throw', 5, '5 each', '60s'),
      ex('Cable Rotation', 4, '8 each', '60s'),
      ex('Batting Tee Swings', 5, '10', '45s'),
    ]},
    REST,
    { day: 'Thu', focus: 'Throwing Velocity', exercises: [
      ex('Plyo Ball Throws', 4, '5 each', '90s'),
      ex('Long Toss', 1, '15 min', '—'),
    ]},
    { day: 'Fri', focus: 'Speed + Fielding', exercises: [
      ex('30-yard Sprint', 6, '1', '90s'),
      ex('Fielding Drills', 5, '15 reps', '45s'),
    ]},
    REST, REST,
  ], 12, 4, 'Rotational power, bat speed, arm health'),
  advanced: mkSportProgram('advanced', 'Baseball', [
    { day: 'Mon', focus: 'Max Power', exercises: [
      ex('Power Clean', 5, '3', '180s'),
      ex('Front Squat', 4, '5', '150s'),
      ex('Med Ball Shotput', 5, '4 each', '90s'),
    ]},
    { day: 'Tue', focus: 'Hitting', exercises: [
      ex('Mechanics Video Analysis + Tee', 1, '30 min', '—'),
      ex('Live BP', 1, '50 swings', '—'),
    ]},
    { day: 'Wed', focus: 'Strength', exercises: [
      ex('Deadlift', 5, '3', '180s'),
      ex('Bench Press', 4, '5', '150s'),
      ex('Weighted Pull-Up', 4, '5', '120s'),
    ]},
    { day: 'Thu', focus: 'Throwing', exercises: [
      ex('Bullpen Session', 1, '30-40 pitches', '—', 'Off-speed and fastball'),
      ex('Band Work', 3, '15', '45s'),
    ]},
    REST,
    { day: 'Sat', focus: 'Game', exercises: [
      ex('Game or Scrimmage', 1, '9 innings', '—'),
    ]},
    REST,
  ], 14, 5, 'Peak rotational output + arm durability for season'),
};

// Rugby
const RUGBY: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Rugby', [
    { day: 'Mon', focus: 'Strength', exercises: [
      ex('Back Squat', 3, '8', '90s'),
      ex('Bench Press', 3, '8', '90s'),
      ex('Bent Row', 3, '8', '90s'),
      ex('Farmer Carry', 3, '40m', '60s', 'Grip strength for rucks'),
    ]},
    { day: 'Tue', focus: 'Contact Skills', exercises: [
      ex('Tackle Bag Drills', 4, '10 hits', '60s', 'Cheek to cheek, drive through'),
      ex('Ruck Clear Drills', 4, '10', '60s'),
      ex('Tackle Recovery (up/down)', 5, '6', '45s'),
    ]},
    REST,
    { day: 'Thu', focus: 'Power', exercises: [
      ex('Trap Bar Deadlift', 3, '6', '120s'),
      ex('Box Jump', 4, '5', '90s'),
      ex('Med Ball Slam', 4, '10', '60s'),
    ]},
    { day: 'Fri', focus: 'Conditioning', exercises: [
      ex('Shuttle Runs (5-10-15m)', 6, '1', '60s'),
      ex('Passing Drills', 5, '2 min', '45s', 'Hands in front, sweep through'),
    ]},
    REST, REST,
  ], 8, 4, 'Contact readiness, strength base, handling skills'),
  intermediate: mkSportProgram('intermediate', 'Rugby', [
    { day: 'Mon', focus: 'Max Strength', exercises: [
      ex('Squat', 5, '5', '180s'),
      ex('Bench Press', 4, '5', '150s'),
      ex('Weighted Chin-Up', 4, '6', '120s'),
    ]},
    { day: 'Tue', focus: 'Contact / Skill', exercises: [
      ex('Live Tackle (controlled)', 5, '5', '90s'),
      ex('Scrum Machine', 4, '5 hits', '90s'),
      ex('Lineout Practice', 4, '8 throws', '60s'),
    ]},
    { day: 'Wed', focus: 'Power', exercises: [
      ex('Power Clean', 4, '3', '150s'),
      ex('Broad Jump', 4, '5', '90s'),
      ex('Med Ball Rotational Throw', 4, '6 each', '60s'),
    ]},
    REST,
    { day: 'Fri', focus: 'Conditioning', exercises: [
      ex('Gassers (80m x 4)', 6, '1', '60s'),
      ex('Bronco Test (sub 5:00)', 1, '1200m total', '—'),
    ]},
    { day: 'Sat', focus: 'Match / Scrimmage', exercises: [
      ex('Touch Rugby or Full Match', 1, '60 min', '—'),
    ]},
    REST,
  ], 10, 5, 'Position-specific power + match conditioning'),
  advanced: mkSportProgram('advanced', 'Rugby', [
    { day: 'Mon', focus: 'Strength Heavy', exercises: [
      ex('Squat', 6, '3 @ RPE 9', '240s'),
      ex('Trap-Bar Deadlift', 5, '3', '180s'),
      ex('Bench Press', 5, '3', '180s'),
    ]},
    { day: 'Tue', focus: 'Contact', exercises: [
      ex('Live Tackle', 6, '5', '90s'),
      ex('Maul + Ruck Reps', 5, '30s', '60s'),
    ]},
    { day: 'Wed', focus: 'Power / Skill', exercises: [
      ex('Hang Clean', 5, '3', '180s'),
      ex('Depth Jump', 4, '4', '120s'),
      ex('Kicking Practice', 1, '20 min', '—'),
    ]},
    { day: 'Thu', focus: 'Conditioning', exercises: [
      ex('Rotating 200m / 400m repeats', 8, '1', '60s'),
      ex('Core Circuit', 3, '60s', '30s'),
    ]},
    REST,
    { day: 'Sat', focus: 'Match', exercises: [
      ex('Full Match', 1, '80 min', '—'),
    ]},
    REST,
  ], 14, 5, 'Pre-season peak — max strength, power, match fitness'),
};

// Cycling
const CYCLING: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Cycling', [
    { day: 'Mon', focus: 'Easy', exercises: [
      ex('Endurance Ride', 1, '45 min @ Zone 2', '—', 'Conversational'),
    ]},
    REST,
    { day: 'Wed', focus: 'Intervals', exercises: [
      ex('Warm-up', 1, '15 min', '—'),
      ex('Sweet Spot (88-93% FTP)', 3, '10 min', '5 min easy'),
      ex('Cool-down', 1, '10 min', '—'),
    ]},
    REST,
    { day: 'Fri', focus: 'Strength (gym)', exercises: [
      ex('Goblet Squat', 3, '10', '75s'),
      ex('Single-Leg RDL', 3, '8 each', '60s'),
      ex('Plank', 3, '45s', '45s'),
    ]},
    { day: 'Sat', focus: 'Long Ride', exercises: [
      ex('Long Endurance Ride', 1, '90 min @ Zone 2', '—'),
    ]},
    REST,
  ], 8, 4, 'Aerobic base, FTP awareness, pedaling efficiency'),
  intermediate: mkSportProgram('intermediate', 'Cycling', [
    { day: 'Mon', focus: 'Easy', exercises: [
      ex('Recovery Spin', 1, '45 min', '—'),
    ]},
    { day: 'Tue', focus: 'Threshold', exercises: [
      ex('Warm-up', 1, '15 min', '—'),
      ex('FTP Intervals', 4, '10 min @ 100% FTP', '5 min easy'),
    ]},
    { day: 'Wed', focus: 'Endurance', exercises: [
      ex('Zone 2 Ride', 1, '90 min', '—'),
    ]},
    REST,
    { day: 'Fri', focus: 'VO2', exercises: [
      ex('3 min VO2 Max Intervals @ 110-115% FTP', 5, '3 min', '3 min easy'),
    ]},
    { day: 'Sat', focus: 'Long', exercises: [
      ex('Long Ride', 1, '3 hrs endurance', '—'),
    ]},
    REST,
  ], 10, 5, 'Raise FTP, climbing power, race pacing'),
  advanced: mkSportProgram('advanced', 'Cycling', [
    { day: 'Mon', focus: 'Recovery', exercises: [
      ex('Recovery Ride', 1, '45 min', '—'),
    ]},
    { day: 'Tue', focus: 'Threshold', exercises: [
      ex('2x20 @ FTP', 2, '20 min', '10 min easy'),
    ]},
    { day: 'Wed', focus: 'Endurance + Cadence', exercises: [
      ex('Endurance + 1 min High Cadence efforts', 1, '2 hrs', '—'),
    ]},
    { day: 'Thu', focus: 'VO2', exercises: [
      ex('5x4 min @ 110% FTP', 5, '4 min', '4 min easy'),
    ]},
    REST,
    { day: 'Sat', focus: 'Long + Climbs', exercises: [
      ex('Long Ride w/ Climbs', 1, '4+ hrs', '—'),
    ]},
    { day: 'Sun', focus: 'Tempo', exercises: [
      ex('2 hrs Tempo (80-85% FTP)', 1, '2 hrs', '—'),
    ]},
  ], 16, 6, 'Race-peak FTP, climbing, group racing tactics'),
};

// Gymnastics
const GYMNASTICS: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Gymnastics', [
    { day: 'Mon', focus: 'Strength', exercises: [
      ex('Hollow Body Hold', 4, '20-30s', '60s', 'Lower back flat'),
      ex('Arch Hold', 4, '20s', '60s'),
      ex('Handstand Wall Holds', 4, '30s', '90s'),
      ex('Push-Up', 3, '10', '60s'),
    ]},
    REST,
    { day: 'Wed', focus: 'Skill + Mobility', exercises: [
      ex('Forward Roll', 3, '5', '45s'),
      ex('Cartwheel Practice', 3, '5 each', '45s'),
      ex('Pike Stretch', 3, '60s', '30s'),
      ex('Bridge Hold', 3, '30s', '45s'),
    ]},
    REST,
    { day: 'Fri', focus: 'Power', exercises: [
      ex('Broad Jump', 4, '5', '90s'),
      ex('Pull-Up', 4, '5-8', '90s'),
      ex('Split Stretch', 3, '60s each', '30s'),
    ]},
    REST, REST,
  ], 10, 3, 'Handstand base, core strength, body tension awareness'),
  intermediate: mkSportProgram('intermediate', 'Gymnastics', [
    { day: 'Mon', focus: 'Upper Strength', exercises: [
      ex('Ring Support Hold', 5, '20s', '90s'),
      ex('Straight Bar Dip', 4, '8', '90s'),
      ex('Pseudo Planche Hold', 4, '20s', '90s'),
    ]},
    { day: 'Tue', focus: 'Floor Skill', exercises: [
      ex('Handstand Practice', 5, '30s', '60s'),
      ex('Round-Off + Cartwheel', 4, '5', '60s'),
      ex('Back Walkover Practice', 4, '3', '90s'),
    ]},
    REST,
    { day: 'Thu', focus: 'Bar / Ring', exercises: [
      ex('Muscle-Up Progression', 5, '3', '120s'),
      ex('Front Lever Tuck', 4, '15s', '90s'),
      ex('L-Sit', 4, '20s', '75s'),
    ]},
    { day: 'Fri', focus: 'Power + Conditioning', exercises: [
      ex('Box Jump', 4, '5', '90s'),
      ex('Plyo Push-Up', 4, '5', '90s'),
      ex('Core Circuit', 3, '45s', '30s'),
    ]},
    REST, REST,
  ], 12, 4, 'Handstand, muscle-up, basic tumbling, ring strength'),
  advanced: mkSportProgram('advanced', 'Gymnastics', [
    { day: 'Mon', focus: 'Planche / Lever', exercises: [
      ex('Planche Progression', 5, '20s', '150s'),
      ex('Front Lever (adv tuck / straddle)', 5, '15s', '120s'),
      ex('Ring Dip', 4, '8', '120s'),
    ]},
    { day: 'Tue', focus: 'Floor', exercises: [
      ex('Tumbling Pass Reps', 6, '1', '90s'),
      ex('Handstand Walk', 5, '10m', '60s'),
    ]},
    { day: 'Wed', focus: 'Rings', exercises: [
      ex('Back Lever Progression', 4, '10s', '120s'),
      ex('Ring Muscle-Up', 5, '3', '120s'),
      ex('Iron Cross Prep', 4, '5-8s', '120s'),
    ]},
    REST,
    { day: 'Fri', focus: 'Power + Flex', exercises: [
      ex('Box Jump', 5, '3', '120s'),
      ex('Split + Straddle Stretch', 3, '90s each', '—'),
    ]},
    { day: 'Sat', focus: 'Event Routines', exercises: [
      ex('Full Routine Walkthroughs', 3, '1 routine', '5 min'),
    ]},
    REST,
  ], 16, 5, 'Advanced skills — planche, lever, ring strength, full routines'),
};

// Golf
const GOLF: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Golf', [
    { day: 'Mon', focus: 'Rotational Mobility', exercises: [
      ex('Thoracic Rotation', 3, '10 each', '45s', 'Golf needs T-spine rotation'),
      ex('Hip 90/90 Stretch', 3, '60s each', '30s'),
      ex('Band Pallof Press', 3, '10 each', '60s', 'Anti-rotation core'),
      ex('Goblet Squat', 3, '10', '60s'),
    ]},
    REST,
    { day: 'Wed', focus: 'Swing Skill', exercises: [
      ex('Slow-mo Swing', 3, '10', '45s'),
      ex('Driving Range Session', 1, '50 balls', '—', 'Tempo focus'),
      ex('Chipping Practice', 1, '30 min', '—'),
    ]},
    REST,
    { day: 'Fri', focus: 'Strength', exercises: [
      ex('DB Romanian Deadlift', 3, '10', '60s'),
      ex('Push-Up', 3, '10', '60s'),
      ex('DB Row', 3, '10 each', '60s'),
      ex('Cable Rotation', 3, '10 each', '60s', 'Golf-swing specific'),
    ]},
    REST, REST,
  ], 8, 3, 'Mobility, core stability, consistent swing mechanics'),
  intermediate: mkSportProgram('intermediate', 'Golf', [
    { day: 'Mon', focus: 'Rotational Power', exercises: [
      ex('Med Ball Rotational Throw', 4, '5 each', '60s'),
      ex('Cable Woodchop', 4, '8 each', '60s'),
      ex('Split Squat', 3, '8 each', '75s'),
    ]},
    { day: 'Tue', focus: 'Skill', exercises: [
      ex('Range Session', 1, '60 balls (short to long)', '—'),
      ex('Bunker Practice', 1, '20 min', '—'),
    ]},
    REST,
    { day: 'Thu', focus: 'Strength', exercises: [
      ex('Trap-Bar Deadlift', 3, '6', '120s'),
      ex('Bench Press', 3, '8', '90s'),
      ex('Weighted Pull-Up', 3, '5', '90s'),
    ]},
    { day: 'Fri', focus: 'Mobility', exercises: [
      ex('Hip + T-Spine Flow', 1, '20 min', '—'),
      ex('Putting Green Practice', 1, '30 min', '—'),
    ]},
    { day: 'Sat', focus: '9/18 Holes', exercises: [
      ex('Play Round', 1, '18 holes', '—'),
    ]},
    REST,
  ], 10, 4, 'Increase club-head speed, consistent ball striking'),
  advanced: mkSportProgram('advanced', 'Golf', [
    { day: 'Mon', focus: 'Power', exercises: [
      ex('Hang Clean', 4, '3', '150s'),
      ex('Med Ball Shotput', 5, '4 each', '90s'),
      ex('Plyo Lateral Bound', 4, '6 each', '90s'),
    ]},
    { day: 'Tue', focus: 'Swing Optimization', exercises: [
      ex('Range Practice w/ launch monitor', 1, '80 balls', '—'),
      ex('Speed Trainer Swings', 3, '10', '60s'),
    ]},
    { day: 'Wed', focus: 'Strength', exercises: [
      ex('Back Squat', 5, '5', '150s'),
      ex('Bench Press', 4, '5', '150s'),
      ex('Row', 4, '6', '90s'),
    ]},
    { day: 'Thu', focus: 'Short Game', exercises: [
      ex('Chipping & Pitching Drills', 1, '60 min', '—'),
      ex('Putting (distance control)', 1, '30 min', '—'),
    ]},
    REST,
    { day: 'Sat', focus: 'Tournament Round', exercises: [
      ex('Play 18 Holes (full pre-shot routine)', 1, '18', '—'),
    ]},
    { day: 'Sun', focus: 'Mobility', exercises: [
      ex('Yoga / T-Spine Flow', 1, '30 min', '—'),
    ]},
  ], 14, 6, 'Club-head speed, consistency, course management'),
};

// Wrestling
const WRESTLING: Record<Level, Program> = {
  beginner: mkSportProgram('beginner', 'Wrestling', [
    { day: 'Mon', focus: 'Technique', exercises: [
      ex('Stance + Motion Drills', 4, '2 min', '45s'),
      ex('Sprawl Reps', 5, '10', '45s', 'Hips to the mat'),
      ex('Shooting Drills (penetration)', 4, '10', '60s'),
      ex('Bridging Drill', 3, '30s', '45s'),
    ]},
    { day: 'Tue', focus: 'Strength', exercises: [
      ex('Pull-Up', 4, '5-8', '90s'),
      ex('Push-Up', 3, '15', '60s'),
      ex('Goblet Squat', 3, '10', '75s'),
      ex('Farmer Carry', 3, '40m', '60s'),
    ]},
    REST,
    { day: 'Thu', focus: 'Live Drilling', exercises: [
      ex('Takedown Drilling (2 min rounds)', 6, '2 min', '60s'),
      ex('Top Control Drilling', 4, '2 min', '60s'),
    ]},
    { day: 'Fri', focus: 'Conditioning', exercises: [
      ex('Wrestling Circuit (sprawls / shots)', 5, '90s', '90s'),
      ex('Core Circuit', 3, '45s', '30s'),
    ]},
    REST, REST,
  ], 10, 4, 'Stance, sprawl, basic takedowns, match conditioning'),
  intermediate: mkSportProgram('intermediate', 'Wrestling', [
    { day: 'Mon', focus: 'Strength', exercises: [
      ex('Deadlift', 4, '5', '150s'),
      ex('Front Squat', 4, '6', '120s'),
      ex('Weighted Chin-Up', 4, '6', '120s'),
    ]},
    { day: 'Tue', focus: 'Live Go', exercises: [
      ex('Live Wrestling', 6, '3 min', '90s'),
      ex('Position Drilling', 4, '2 min', '60s'),
    ]},
    { day: 'Wed', focus: 'Power', exercises: [
      ex('Hang Clean', 4, '3', '150s'),
      ex('Box Jump', 4, '5', '90s'),
      ex('Med Ball Slam', 4, '10', '60s'),
    ]},
    REST,
    { day: 'Fri', focus: 'Technique', exercises: [
      ex('Series Drilling (setup → TD)', 5, '10 reps', '60s'),
      ex('Riding Drills', 4, '90s', '60s'),
    ]},
    { day: 'Sat', focus: 'Conditioning', exercises: [
      ex('6 min Match Simulation', 5, '1', '3 min', 'Mirror match structure'),
    ]},
    REST,
  ], 12, 5, 'Live wrestling capacity, technique depth, strength base'),
  advanced: mkSportProgram('advanced', 'Wrestling', [
    { day: 'Mon', focus: 'Max Strength', exercises: [
      ex('Squat', 5, '3 @ RPE 9', '180s'),
      ex('Deadlift', 4, '3', '180s'),
      ex('Weighted Pull-Up', 4, '5', '120s'),
    ]},
    { day: 'Tue', focus: 'Live Matches', exercises: [
      ex('Live Matches', 6, '6 min', '90s'),
    ]},
    { day: 'Wed', focus: 'Power', exercises: [
      ex('Power Clean', 5, '3', '180s'),
      ex('Depth Jump', 4, '4', '120s'),
    ]},
    { day: 'Thu', focus: 'Technique', exercises: [
      ex('Drilling + Chain Series', 6, '90s', '45s'),
    ]},
    REST,
    { day: 'Sat', focus: 'Tournament', exercises: [
      ex('Match Simulations', 4, '6 min', '5 min', 'Competition pace'),
    ]},
    REST,
  ], 14, 5, 'Peak match readiness — strength, power, live skill'),
};

// ============================================================
// MASTER SPORT LIST
// ============================================================
// ============================================================
// VOLUME AUGMENTATION (Schoenfeld research-based minimums)
// Beginner: 10-12 sets per muscle group/week
// Intermediate: 15-18 sets per muscle group/week
// Advanced: 18-22 sets per muscle group/week
// Per-session minimums per user spec:
//   Boxing: 8 exercises | Soccer: 7 | Powerlifting: keep main + accessories | Calisthenics: skills + drills | Others: 6-8
// ============================================================

type AccessoryPool = Exercise[];

// Sport-specific accessory pools (used to pad under-volume sessions)
const ACCESSORIES: Record<string, AccessoryPool> = {
  boxing: [
    ex('Neck Curl', 3, '12-15', '45s', 'Lying neck curl with plate — head trauma prevention'),
    ex('Russian Twist (weighted)', 3, '15 each side', '45s', 'Rotational core power for punches'),
    ex('Cable Woodchop', 3, '12 each side', '45s', 'Hip-driven rotation, mimics cross power'),
    ex('Burpee', 3, '10', '45s', 'Anaerobic conditioning'),
    ex('Battle Rope Slams', 4, '30s rounds', '30s', 'Match-style conditioning rounds'),
    ex('Heavy Bag — Body Shots', 3, '2 min round', '60s', 'Stay relaxed, breathe through punches'),
  ],
  powerlifting: [
    ex('Hammer Curl', 3, '10-12', '60s', 'Bicep + grip support for pulls'),
    ex('Tricep Pushdown', 3, '10-15', '60s', 'Lockout strength on bench'),
    ex('Barbell Row', 3, '8-10', '90s', 'Back accessory for squat/dead'),
    ex('Romanian Deadlift', 3, '8-10', '90s', 'Posterior chain assistance'),
    ex('Pause Squat', 3, '5', '180s', '3-second pause — out of the hole strength'),
    ex('Close-Grip Bench Press', 3, '6-8', '120s', 'Tricep-driven bench accessory'),
    ex('Good Morning', 3, '8-10', '90s', 'Erector & hamstring strength'),
  ],
  calisthenics: [
    ex('L-Sit Hold', 3, '15-30s', '60s', 'Core + compression — straddle if needed'),
    ex('Pseudo Planche Lean', 3, '20s', '60s', 'Planche progression — stack shoulders forward'),
    ex('Tuck Front Lever Hold', 3, '10-20s', '60s', 'Lat + core static — knees to chest'),
    ex('Skin the Cat', 3, '5', '60s', 'Shoulder mobility + control on rings/bar'),
    ex('Pistol Squat Progression', 3, '5 each side', '90s', 'Box-assisted if not full ROM'),
    ex('Hollow Body Hold', 3, '20-30s', '45s', 'Ribs down, lower back pressed flat'),
  ],
  soccer: [
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Hamstring + glute + balance — injury prevention'),
    ex('Copenhagen Plank', 3, '15-30s each side', '45s', 'Adductor strength — groin injury prevention'),
    ex('Bounding (alt-leg)', 3, '20m', '60s', 'Plyometric stride length'),
    ex('Lateral Lunge', 3, '8 each side', '60s', 'Frontal-plane mobility + strength'),
    ex('Nordic Curl', 3, '5-8', '90s', 'Eccentric hamstring — hamstring tear prevention'),
    ex('Glute Bridge March', 3, '10 each side', '45s', 'Glute activation + core control'),
  ],
  basketball: [
    ex('Box Jump', 3, '5', '90s', 'Vertical power — step down between reps'),
    ex('Bulgarian Split Squat', 3, '8 each side', '90s', 'Unilateral leg drive for jumps'),
    ex('Calf Raise', 4, '12-15', '60s', 'Achilles resilience — landing absorption'),
    ex('Romanian Deadlift', 3, '8-10', '90s', 'Hamstring strength — sprint mechanics'),
    ex('Med Ball Chest Pass', 3, '6', '60s', 'Upper body explosive power'),
    ex('Lateral Bound', 3, '6 each side', '60s', 'Defensive cuts'),
  ],
  swimming: [
    ex('Lat Pulldown', 3, '10-12', '75s', 'Pull strength for stroke'),
    ex('Face Pull', 3, '15-20', '60s', 'Rotator cuff health — shoulder durability'),
    ex('Pallof Press', 3, '10 each side', '45s', 'Anti-rotation core — streamline strength'),
    ex('Push-Up', 3, '10-15', '60s', 'Stroke pushing strength'),
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Kick power + balance'),
    ex('Kickboard Sprint', 3, '50m', '60s', 'Leg endurance for finish'),
  ],
  track: [
    ex('Hip Thrust', 4, '8-10', '90s', 'Glute power for stride'),
    ex('Bulgarian Split Squat', 3, '8 each side', '90s', 'Unilateral hip strength'),
    ex('A-Skip', 3, '20m', '45s', 'Sprint mechanics drill'),
    ex('Med Ball Slam', 3, '8', '45s', 'Vertical power'),
    ex('Romanian Deadlift', 3, '8-10', '90s', 'Hamstring mass + strength'),
    ex('Calf Raise', 4, '12-15', '60s', 'Ankle stiffness for sprint'),
  ],
  mma: [
    ex('Turkish Get-Up', 3, '3 each side', '60s', 'Full body control + shoulder stability'),
    ex('Single Arm Row', 3, '10 each side', '60s', 'Pulling strength for clinch / takedowns'),
    ex('Bear Crawl', 3, '20m', '45s', 'Coordination + scramble strength'),
    ex('Front Squat', 3, '6-8', '120s', 'Squat strength — preserves trunk position'),
    ex('Chin-Up', 3, '6-10', '90s', 'Pulling for grappling'),
    ex('Burpee', 3, '8', '45s', 'Conditioning'),
  ],
  volleyball: [
    ex('Box Jump', 3, '5', '90s', 'Vertical jump'),
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Hamstring + balance'),
    ex('Face Pull', 4, '15', '60s', 'Shoulder durability — overhead spike health'),
    ex('External Rotation (band)', 3, '12 each side', '45s', 'Rotator cuff'),
    ex('Calf Raise', 3, '15', '60s', 'Spring ankle'),
    ex('Pallof Press', 3, '10 each side', '45s', 'Anti-rotation core'),
  ],
  hockey: [
    ex('Lateral Lunge', 3, '8 each side', '60s', 'Skating stride mobility'),
    ex('Goblet Squat', 3, '10', '60s', 'Skating depth strength'),
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Edge control balance'),
    ex('Pallof Press', 3, '10 each side', '45s', 'Slap-shot core stability'),
    ex('Med Ball Rotational Throw', 3, '6 each side', '60s', 'Shot power'),
    ex('Sled Push', 3, '20m', '90s', 'Skating start power'),
  ],
  baseball: [
    ex('Med Ball Rotational Slam', 3, '6 each side', '60s', 'Bat speed / pitch velocity'),
    ex('External Rotation (band)', 3, '15 each side', '45s', 'Rotator cuff health — pitching arm'),
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Stride leg balance'),
    ex('Cable Woodchop', 3, '10 each side', '45s', 'Hip rotation transfer'),
    ex('Romanian Deadlift', 3, '8-10', '90s', 'Posterior chain'),
    ex('Reverse Lunge', 3, '8 each side', '60s', 'Stride mechanics'),
  ],
  rugby: [
    ex('Yoke Walk (or Farmer)', 3, '20m', '120s', 'Trap & grip strength for contact'),
    ex('Pendlay Row', 3, '8', '90s', 'Pulling strength for tackles'),
    ex('Bulgarian Split Squat', 3, '8 each side', '90s', 'Unilateral leg drive'),
    ex('Neck Curl', 3, '12-15', '45s', 'Neck strength — concussion mitigation'),
    ex('Sled Push', 3, '20m', '120s', 'Scrum drive power'),
    ex('Pallof Press', 3, '10 each side', '45s', 'Anti-rotation for collisions'),
  ],
  cycling: [
    ex('Bulgarian Split Squat', 3, '10 each side', '75s', 'Unilateral pedal stroke power'),
    ex('Goblet Squat', 3, '10', '60s', 'Quad strength on climbs'),
    ex('Romanian Deadlift', 3, '8-10', '90s', 'Hamstring balance'),
    ex('Hip Thrust', 3, '10', '75s', 'Glute drive — out of saddle power'),
    ex('Plank', 3, '45s', '45s', 'Saddle stability core'),
    ex('Side Plank', 3, '30s each side', '45s', 'Lateral trunk for sprints'),
  ],
  gymnastics: [
    ex('Hollow Body Hold', 3, '30s', '45s', 'Foundation hold for all skills'),
    ex('Arch Body Hold', 3, '20s', '45s', 'Posterior chain shape'),
    ex('Pseudo Planche Lean', 3, '20s', '60s', 'Planche progression'),
    ex('Tuck Front Lever Hold', 3, '15s', '60s', 'Lat compression'),
    ex('Wall Handstand Hold', 3, '30s', '60s', 'Vertical balance'),
    ex('Skin the Cat', 3, '5', '60s', 'Shoulder mobility on rings'),
  ],
  golf: [
    ex('Cable Woodchop (high to low)', 3, '10 each side', '45s', 'Swing pattern rotation'),
    ex('Pallof Press', 3, '10 each side', '45s', 'Anti-rotation — swing stability'),
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Trail leg balance'),
    ex('Goblet Squat', 3, '10', '60s', 'Hip mobility + posture'),
    ex('Bird Dog', 3, '8 each side', '45s', 'Spinal stability'),
    ex('Med Ball Rotational Throw', 3, '6 each side', '60s', 'Rotational power transfer'),
  ],
  wrestling: [
    ex('Bear Crawl', 3, '20m', '45s', 'Scramble strength'),
    ex('Sled Push', 3, '20m', '90s', 'Drive power'),
    ex('Pull-Up', 3, '6-10', '90s', 'Pulling strength for ties'),
    ex('Front Squat', 3, '6-8', '120s', 'Hold-position strength'),
    ex('Turkish Get-Up', 3, '3 each side', '60s', 'Floor scramble + control'),
    ex('Neck Curl', 3, '12-15', '45s', 'Neck strength for bridges'),
  ],
  football: [
    ex('Box Jump', 3, '5', '90s', 'Vertical power'),
    ex('Bulgarian Split Squat', 3, '8 each side', '90s', 'Unilateral leg drive'),
    ex('Pendlay Row', 3, '8', '90s', 'Back strength for blocks'),
    ex('Sled Push', 3, '20m', '120s', 'Drive power'),
    ex('Med Ball Rotational Throw', 3, '6 each side', '60s', 'Rotational power'),
    ex('Neck Curl', 3, '12-15', '45s', 'Concussion mitigation'),
  ],
  general: [
    ex('Lateral Lunge', 3, '8 each side', '60s', 'Frontal-plane mobility'),
    ex('Face Pull', 3, '15', '60s', 'Posture + shoulder health'),
    ex('Plank', 3, '45s', '45s', 'Core stability'),
    ex('Hip Thrust', 3, '10-12', '75s', 'Glute strength'),
    ex('Single Leg RDL', 3, '8 each side', '60s', 'Balance + posterior chain'),
    ex('Push-Up', 3, '10-15', '60s', 'Bodyweight push'),
  ],
};

// Per-sport per-session minimum exercise count
const MIN_EX_PER_SESSION: Record<string, number> = {
  boxing: 8,
  soccer: 7,
  powerlifting: 6, // main lift + accessories
  calisthenics: 7,
  basketball: 7,
  football: 7,
  swimming: 7,
  track: 6,
  mma: 8,
  volleyball: 7,
  hockey: 7,
  baseball: 7,
  rugby: 7,
  cycling: 6,
  gymnastics: 8,
  golf: 6,
  wrestling: 8,
  general: 7,
};

const augmentProgram = (sportId: string, prog: Program): Program => {
  const minN = MIN_EX_PER_SESSION[sportId] ?? 6;
  const pool = ACCESSORIES[sportId] ?? ACCESSORIES.general;
  const augmentedWeekly = prog.weekly.map((day) => {
    if (day.day === 'Rest' || day.exercises.length === 0) return day;
    if (day.exercises.length >= minN) return day;
    // Pad with accessories not already in this day's plan
    const have = new Set(day.exercises.map((e) => e.name.toLowerCase()));
    const adds: Exercise[] = [];
    for (const a of pool) {
      if (adds.length + day.exercises.length >= minN) break;
      if (!have.has(a.name.toLowerCase())) {
        adds.push(a);
        have.add(a.name.toLowerCase());
      }
    }
    return { ...day, exercises: [...day.exercises, ...adds] };
  });
  return { ...prog, weekly: augmentedWeekly };
};

const augmentSport = (sportId: string, programs: Record<Level, Program>): Record<Level, Program> => ({
  beginner: augmentProgram(sportId, programs.beginner),
  intermediate: augmentProgram(sportId, programs.intermediate),
  advanced: augmentProgram(sportId, programs.advanced),
});

export const SPORTS: Sport[] = [
  { id: 'boxing', name: 'Boxing', emoji: '🥊', category: 'combat', blurb: 'Punch mechanics + anaerobic power', programs: augmentSport('boxing', BOXING) },
  { id: 'calisthenics', name: 'Calisthenics', emoji: '🤸', category: 'skill', blurb: 'Body-weight strength + skills', programs: augmentSport('calisthenics', CALISTHENICS) },
  { id: 'soccer', name: 'Soccer', emoji: '⚽', category: 'team', blurb: 'Speed, agility, aerobic base', programs: augmentSport('soccer', SOCCER) },
  { id: 'basketball', name: 'Basketball', emoji: '🏀', category: 'team', blurb: 'Vertical jump + shooting', programs: augmentSport('basketball', BASKETBALL) },
  { id: 'football', name: 'American Football', emoji: '🏈', category: 'team', blurb: 'Max strength + positional power', programs: augmentSport('football', FOOTBALL) },
  { id: 'swimming', name: 'Swimming', emoji: '🏊', category: 'endurance', blurb: 'Technique + cardio capacity', programs: augmentSport('swimming', SWIMMING) },
  { id: 'powerlifting', name: 'Powerlifting', emoji: '🏋️', category: 'strength', blurb: 'Squat / Bench / Deadlift 1RM', programs: augmentSport('powerlifting', POWERLIFTING) },
  { id: 'track', name: 'Track & Field', emoji: '🏃', category: 'endurance', blurb: 'Running & event-specific speed', programs: augmentSport('track', TRACK) },
  { id: 'mma', name: 'MMA', emoji: '🥋', category: 'combat', blurb: 'Striking + grappling + cardio', programs: augmentSport('mma', MMA) },
  { id: 'volleyball', name: 'Volleyball', emoji: '🏐', category: 'team', blurb: 'Vertical jump + shoulder durability', programs: augmentSport('volleyball', VOLLEYBALL) },
  { id: 'hockey', name: 'Hockey', emoji: '🏒', category: 'team', blurb: 'Skating power + shot velocity', programs: augmentSport('hockey', HOCKEY) },
  { id: 'baseball', name: 'Baseball', emoji: '⚾', category: 'team', blurb: 'Rotational power + arm health', programs: augmentSport('baseball', BASEBALL) },
  { id: 'rugby', name: 'Rugby', emoji: '🏉', category: 'team', blurb: 'Contact strength + match cardio', programs: augmentSport('rugby', RUGBY) },
  { id: 'cycling', name: 'Cycling', emoji: '🚴', category: 'endurance', blurb: 'FTP, climbing, endurance', programs: augmentSport('cycling', CYCLING) },
  { id: 'gymnastics', name: 'Gymnastics', emoji: '🤸', category: 'skill', blurb: 'Handstand, rings, tumbling', programs: augmentSport('gymnastics', GYMNASTICS) },
  { id: 'golf', name: 'Golf', emoji: '⛳', category: 'skill', blurb: 'Rotational power + mobility', programs: augmentSport('golf', GOLF) },
  { id: 'wrestling', name: 'Wrestling', emoji: '🤼', category: 'combat', blurb: 'Takedowns + anaerobic capacity', programs: augmentSport('wrestling', WRESTLING) },
  { id: 'general', name: 'General Fitness', emoji: '💪', category: 'general', blurb: 'Strength + cardio + longevity', programs: augmentSport('general', GENERAL) },
];

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  beginner: 'New to structured training, or coming back after 3+ months off. Build movement quality and consistent habits.',
  intermediate: '6+ months of consistent training. Ready for higher volume, periodization, and sport-specific drills.',
  advanced: '2+ years of dedicated training. Peaking for competition or chasing elite-level skills.',
};

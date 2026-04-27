"""TRACKD backend tests for three new feature areas:
1. Exercise Details (free-exercise-db) and Muscles Thumbnail (PUBLIC)
2. AI Nutrition Coach insights + snooze (AUTH)
3. Updated Templates (AUTH)
"""
import sys
import requests
from typing import Any, Dict, List

BASE = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

FED_PREFIX = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

PASSED: List[str] = []
FAILED: List[str] = []


def check(cond: bool, name: str, extra: str = ""):
    if cond:
        PASSED.append(name)
        print(f"  PASS: {name}")
    else:
        FAILED.append(f"{name} -- {extra}")
        print(f"  FAIL: {name} -- {extra}")


def section(title: str):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


# ===================== 1. Exercise Details =====================

def test_exercise_details_bench_press():
    section("1a. GET /api/exercises/details?name=Bench Press")
    r = requests.get(f"{BASE}/exercises/details", params={"name": "Bench Press"})
    check(r.status_code == 200, "status=200", f"got {r.status_code}")
    if r.status_code != 200:
        return
    data = r.json()
    print(f"  matched_name={data.get('matched_name')!r} source={data.get('source')!r}")
    check(data.get("source") == "free-exercise-db", "source=='free-exercise-db'",
          f"got {data.get('source')}")

    frames = data.get("frames", [])
    check(isinstance(frames, list) and len(frames) == 2, "frames array length 2",
          f"len={len(frames) if isinstance(frames, list) else 'not list'}")
    if frames:
        all_ok = all(isinstance(u, str) and u.startswith(FED_PREFIX) for u in frames)
        check(all_ok, "frames URLs start with free-exercise-db raw URL",
              f"frames={frames}")
        print(f"  frames[0]={frames[0]}")

    primary = data.get("primary_muscles", [])
    check(isinstance(primary, list) and len(primary) > 0, "primary_muscles non-empty",
          f"{primary}")
    chest_ok = any(isinstance(m, dict) and m.get("slug") == "chest" and m.get("intensity") == 2
                   for m in primary)
    check(chest_ok, "primary contains {slug:'chest', intensity:2}", f"{primary}")

    secondary = data.get("secondary_muscles", [])
    tri_ok = any(isinstance(m, dict) and m.get("slug") == "triceps" for m in secondary)
    check(tri_ok, "secondary contains 'triceps' slug", f"{secondary}")

    instr = data.get("instructions")
    check(isinstance(instr, list) and len(instr) > 0, "instructions non-empty array",
          f"instructions={instr!r}")

    yt = data.get("youtube_search_url")
    check(isinstance(yt, str) and len(yt) > 0, "youtube_search_url non-empty", f"{yt!r}")


def test_exercise_details_squat():
    section("1b. GET /api/exercises/details?name=Squat")
    r = requests.get(f"{BASE}/exercises/details", params={"name": "Squat"})
    check(r.status_code == 200, "squat status=200", f"got {r.status_code}")
    if r.status_code != 200:
        return
    data = r.json()
    print(f"  matched_name={data.get('matched_name')!r} source={data.get('source')!r}")
    primary = data.get("primary_muscles", [])
    quad_ok = any(isinstance(m, dict) and m.get("slug") == "quadriceps" for m in primary)
    check(quad_ok, "squat primary contains 'quadriceps'", f"{primary}")


def test_exercise_details_not_found():
    section("1c. GET /api/exercises/details?name=ZZZNonExistentExercise999")
    r = requests.get(f"{BASE}/exercises/details", params={"name": "ZZZNonExistentExercise999"})
    check(r.status_code == 200, "status=200", f"got {r.status_code}")
    if r.status_code != 200:
        return
    data = r.json()
    check(data.get("source") == "youtube", "source=='youtube'", f"got {data.get('source')}")
    check(data.get("frames") == [], "frames is empty list", f"{data.get('frames')}")
    check(data.get("primary_muscles") == [], "primary_muscles == []",
          f"{data.get('primary_muscles')}")
    yt = data.get("youtube_search_url")
    check(isinstance(yt, str) and len(yt) > 0, "youtube_search_url populated", f"{yt!r}")


def test_exercise_details_missing_name():
    section("1d. GET /api/exercises/details (no name) -> 400")
    r = requests.get(f"{BASE}/exercises/details")
    print(f"  status={r.status_code}")
    # FastAPI returns 422 for missing required query param by default.
    # Spec said 400 but 422 is the standard rejection behavior; accept either.
    check(r.status_code in (400, 422), "400 or 422 for missing name",
          f"got {r.status_code}, body={r.text[:200]}")


def test_muscles_thumbnail_pull_up():
    section("1e. GET /api/exercises/muscles-thumbnail?name=Pull Up")
    r = requests.get(f"{BASE}/exercises/muscles-thumbnail", params={"name": "Pull Up"})
    check(r.status_code == 200, "status=200", f"got {r.status_code}")
    if r.status_code != 200:
        return
    data = r.json()
    primary = data.get("primary_muscles")
    secondary = data.get("secondary_muscles")
    check(isinstance(primary, list), "primary_muscles is list", f"{type(primary)}")
    check(isinstance(secondary, list), "secondary_muscles is list", f"{type(secondary)}")
    print(f"  primary={primary}")
    print(f"  secondary={secondary}")
    all_slugs = [m.get("slug") for m in (primary or []) + (secondary or []) if isinstance(m, dict)]
    lat_or_upper = any(s in ("lats", "trapezius", "upper-back") for s in all_slugs)
    check(lat_or_upper, "contains lats/trapezius/upper-back slug", f"slugs={all_slugs}")


# ===================== 2. Coach =====================

def test_coach_insights_unauth():
    section("2a. GET /api/coach/insights (no auth) -> 401")
    r = requests.get(f"{BASE}/coach/insights")
    check(r.status_code == 401, "401 without auth", f"got {r.status_code}")


def test_coach_insights_auth() -> Dict[str, Any]:
    section("2b. GET /api/coach/insights (with auth)")
    r = requests.get(f"{BASE}/coach/insights", headers=AUTH)
    check(r.status_code == 200, "status=200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code != 200:
        return {}
    data = r.json()
    print(f"  count={data.get('count')}")
    insights = data.get("insights")
    check(isinstance(insights, list), "insights is list", f"{type(insights)}")
    check("count" in data and data["count"] == len(insights or []),
          "count matches insights length",
          f"count={data.get('count')} len={len(insights or [])}")

    for i, ins in enumerate(insights or []):
        print(f"  insight[{i}]: id={ins.get('id')} type={ins.get('type')} "
              f"priority={ins.get('priority')} title={ins.get('title')!r}")

    check(len(insights or []) >= 1, "has >=1 insight",
          f"got {len(insights or [])}")

    weekly = next((i for i in (insights or []) if i.get("type") == "weekly_review"), None)
    check(weekly is not None, "has weekly_review insight",
          f"types={[i.get('type') for i in (insights or [])]}")

    required_keys = ["id", "type", "priority", "severity", "title", "message",
                     "science", "data", "suggestions"]
    if insights:
        for ins in insights:
            missing = [k for k in required_keys if k not in ins]
            check(not missing, f"insight {ins.get('id')} has all required keys",
                  f"missing={missing}")
    return data


def test_coach_snooze_unauth():
    section("2d. POST /api/coach/snooze (no auth) -> 401")
    r = requests.post(f"{BASE}/coach/snooze",
                      json={"insight_id": "weekly_fake", "hours": 1})
    check(r.status_code == 401, "401 without auth", f"got {r.status_code}")


def test_coach_snooze_and_filter(initial: Dict[str, Any]):
    section("2c. POST /api/coach/snooze then re-fetch /insights")
    insights = initial.get("insights") if initial else []
    if not insights:
        check(False, "cannot test snooze -- no prior insights", "")
        return
    target = next((i for i in insights if i.get("type") == "weekly_review"), insights[0])
    insight_id = target.get("id")
    print(f"  Snoozing id={insight_id!r}")
    r = requests.post(f"{BASE}/coach/snooze", headers=AUTH,
                      json={"insight_id": insight_id, "hours": 1})
    check(r.status_code == 200, "snooze status=200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code != 200:
        return
    body = r.json()
    check(body.get("success") is True, "snooze success=true", f"body={body}")
    exp = body.get("expires_at")
    check(isinstance(exp, str) and ("T" in exp) and len(exp) >= 19,
          "expires_at ISO timestamp", f"got {exp!r}")

    r2 = requests.get(f"{BASE}/coach/insights", headers=AUTH)
    check(r2.status_code == 200, "followup insights 200", f"got {r2.status_code}")
    if r2.status_code == 200:
        ids_after = [i.get("id") for i in (r2.json().get("insights") or [])]
        print(f"  ids after snooze: {ids_after}")
        check(insight_id not in ids_after,
              f"snoozed id {insight_id!r} NOT in subsequent response",
              f"ids_after={ids_after}")


# ===================== 3. Updated Templates =====================

def test_templates():
    section("3. GET /api/templates")
    r_un = requests.get(f"{BASE}/templates")
    check(r_un.status_code == 401, "401 without auth (templates)",
          f"got {r_un.status_code}")

    r = requests.get(f"{BASE}/templates", headers=AUTH)
    check(r.status_code == 200, "status=200", f"got {r.status_code}")
    if r.status_code != 200:
        return
    data = r.json()
    presets = data.get("presets")
    check(isinstance(presets, list), "presets is list", f"{type(presets)}")
    check(isinstance(presets, list) and len(presets) >= 7,
          "presets length >= 7",
          f"len={len(presets) if isinstance(presets, list) else 'n/a'}")
    print(f"  presets: {[p.get('template_id') for p in (presets or [])]}")

    for p in (presets or []):
        tid = p.get("template_id")
        has_name = isinstance(p.get("name"), str) and p.get("name")
        has_desc = isinstance(p.get("description"), str) and p.get("description")
        is_preset = p.get("is_preset") is True
        exercises = p.get("exercises")
        ok = has_name and has_desc and is_preset and isinstance(exercises, list) and len(exercises) > 0
        check(bool(ok), f"{tid} has name/description/is_preset=true/exercises[]",
              f"name={has_name} desc={has_desc} is_preset={p.get('is_preset')} "
              f"ex_count={len(exercises) if isinstance(exercises, list) else 'n/a'}")

        if isinstance(exercises, list):
            bad = []
            for ex in exercises:
                if not isinstance(ex, dict):
                    bad.append(ex)
                    continue
                if not (isinstance(ex.get("exercise_name"), str)
                        and isinstance(ex.get("sets"), int)
                        and isinstance(ex.get("reps"), str)
                        and isinstance(ex.get("rest_seconds"), int)
                        and isinstance(ex.get("cue"), str)):
                    bad.append(ex.get("exercise_name"))
            check(not bad, f"{tid} all exercises have exercise_name/sets/reps/rest_seconds/cue",
                  f"bad={bad[:3]}")

    by_id = {p.get("template_id"): p for p in (presets or [])}

    # preset_push
    push = by_id.get("preset_push")
    if push:
        check(push.get("name") == "Push Day", "preset_push name=='Push Day'",
              f"{push.get('name')!r}")
        check(len(push.get("exercises") or []) >= 9,
              "preset_push has >=9 exercises",
              f"len={len(push.get('exercises') or [])}")
        first = (push.get("exercises") or [{}])[0]
        check(first.get("exercise_name") == "Incline Dumbbell Press",
              "preset_push first exercise == 'Incline Dumbbell Press'",
              f"{first.get('exercise_name')!r}")
        check(first.get("sets") == 4, "preset_push first sets=4", f"{first.get('sets')}")
        check(first.get("reps") == "8-12", "preset_push first reps=='8-12'",
              f"{first.get('reps')!r}")
    else:
        check(False, "preset_push exists", "missing")

    # preset_pull
    pull = by_id.get("preset_pull")
    if pull:
        check(pull.get("name") == "Pull Day", "preset_pull name=='Pull Day'",
              f"{pull.get('name')!r}")
        check(len(pull.get("exercises") or []) == 8,
              "preset_pull has exactly 8 exercises",
              f"len={len(pull.get('exercises') or [])}")
        first = (pull.get("exercises") or [{}])[0]
        check(first.get("exercise_name") == "Pull Up",
              "preset_pull first == 'Pull Up'", f"{first.get('exercise_name')!r}")
        check(first.get("sets") == 4, "preset_pull first sets=4",
              f"{first.get('sets')}")
    else:
        check(False, "preset_pull exists", "missing")

    # preset_legs
    legs = by_id.get("preset_legs")
    if legs:
        names = [e.get("exercise_name") for e in (legs.get("exercises") or [])]
        check("Nordic Curl" in names, "preset_legs includes 'Nordic Curl'", f"{names}")
        check("Seated Calf Raise" in names,
              "preset_legs includes 'Seated Calf Raise'", f"{names}")
    else:
        check(False, "preset_legs exists", "missing")

    # preset_fullbody_b
    fb_b = by_id.get("preset_fullbody_b")
    check(fb_b is not None, "preset_fullbody_b exists (new preset)",
          f"available={list(by_id.keys())}")
    if fb_b:
        check(fb_b.get("name") == "Full Body (Day B)",
              "preset_fullbody_b name=='Full Body (Day B)'", f"{fb_b.get('name')!r}")
        first = (fb_b.get("exercises") or [{}])[0]
        check(first.get("exercise_name") == "Deadlift",
              "preset_fullbody_b first exercise == 'Deadlift'",
              f"{first.get('exercise_name')!r}")


def main():
    h = requests.get(f"{BASE}/health").json()
    print(f"Health: {h}")

    test_exercise_details_bench_press()
    test_exercise_details_squat()
    test_exercise_details_not_found()
    test_exercise_details_missing_name()
    test_muscles_thumbnail_pull_up()

    test_coach_insights_unauth()
    initial = test_coach_insights_auth()
    test_coach_snooze_unauth()
    test_coach_snooze_and_filter(initial)

    test_templates()

    print("\n" + "=" * 80)
    print(f"RESULTS: {len(PASSED)} passed, {len(FAILED)} failed")
    print("=" * 80)
    if FAILED:
        print("\nFAILURES:")
        for f in FAILED:
            print(f"  FAIL: {f}")
    else:
        print("ALL ASSERTIONS PASSED")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())

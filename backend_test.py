"""
TRACKD pivot backend tests.
Tests new endpoints: onboarding, measurements, exercise library, PRs, templates, plate calculator.
"""
import sys
import requests

BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"
SESSION_TOKEN = "test_session_trackd_1777237904201"
HEADERS = {"Authorization": f"Bearer {SESSION_TOKEN}", "Content-Type": "application/json"}

passed = 0
failed = 0
failures = []


def check(name: str, condition: bool, details: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
    else:
        failed += 1
        failures.append(f"{name} :: {details}")
        print(f"  FAIL  {name}  -- {details}")


def section(title: str):
    print(f"\n=== {title} ===")


# ---------------- Onboarding ----------------
section("1. Onboarding API")

r = requests.post(f"{BASE_URL}/onboarding/complete", json={
    "name": "John", "age": 28, "biological_sex": "male",
    "height_cm": 180, "weight_kg": 80,
    "activity_level": "moderately_active", "goal_type": "build_muscle", "sport": "powerlifting"
})
check("POST /onboarding/complete without auth -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE_URL}/onboarding/status")
check("GET /onboarding/status without auth -> 401", r.status_code == 401, f"got {r.status_code}")

payload = {
    "name": "John",
    "age": 28,
    "biological_sex": "male",
    "height_cm": 180,
    "weight_kg": 80,
    "activity_level": "moderately_active",
    "goal_type": "build_muscle",
    "sport": "powerlifting"
}
r = requests.post(f"{BASE_URL}/onboarding/complete", json=payload, headers=HEADERS)
check("POST /onboarding/complete returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:300]}")

if r.status_code == 200:
    data = r.json()
    check("response.success = True", data.get("success") is True, str(data.get("success")))
    check("BMR == 1790", data.get("bmr") == 1790, f"got bmr={data.get('bmr')}")
    check("TDEE rounded ~ 2774-2775", data.get("tdee") in (2774, 2775), f"got tdee={data.get('tdee')}")
    check("goal_calories ~ 3024-3025 (tdee+250)", data.get("goal_calories") in (3024, 3025),
          f"got={data.get('goal_calories')}")
    macros = data.get("macros", {})
    check("macros.protein == 160 (2g/kg)", macros.get("protein") == 160, f"got={macros.get('protein')}")
    check("macros.carbs is int", isinstance(macros.get("carbs"), int), f"got={macros.get('carbs')}")
    check("macros.fats is int", isinstance(macros.get("fats"), int), f"got={macros.get('fats')}")

r = requests.get(f"{BASE_URL}/onboarding/status", headers=HEADERS)
check("GET /onboarding/status returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    check("onboarding_complete == True after onboarding",
          r.json().get("onboarding_complete") is True, str(r.json()))


# ---------------- Measurements ----------------
section("2. Body Measurements API")

r = requests.get(f"{BASE_URL}/measurements")
check("GET /measurements without auth -> 401", r.status_code == 401, f"got {r.status_code}")
r = requests.post(f"{BASE_URL}/measurements", json={"weight_kg": 80})
check("POST /measurements without auth -> 401", r.status_code == 401, f"got {r.status_code}")
r = requests.get(f"{BASE_URL}/measurements/weight")
check("GET /measurements/weight without auth -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE_URL}/measurements", headers=HEADERS)
check("GET /measurements returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")
if r.status_code == 200:
    measurements = r.json().get("measurements", [])
    check("measurements list non-empty (initial from onboarding)",
          len(measurements) >= 1, f"got {len(measurements)}")

r = requests.post(f"{BASE_URL}/measurements",
                  json={"weight_kg": 79.5, "chest_cm": 105, "waist_cm": 85, "neck_cm": 40},
                  headers=HEADERS)
check("POST /measurements returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:300]}")
if r.status_code == 200:
    data = r.json()
    check("new measurement weight_kg=79.5", data.get("weight_kg") == 79.5, str(data.get("weight_kg")))
    check("new measurement chest_cm=105", data.get("chest_cm") == 105, str(data.get("chest_cm")))
    check("new measurement waist_cm=85", data.get("waist_cm") == 85, str(data.get("waist_cm")))
    check("measurement_id present", bool(data.get("measurement_id")), "missing")

r = requests.get(f"{BASE_URL}/measurements/weight?days=30", headers=HEADERS)
check("GET /measurements/weight returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")
if r.status_code == 200:
    weights = r.json().get("weights", [])
    check("weights list non-empty after onboarding+measurement", len(weights) >= 1,
          f"got {len(weights)}")


# ---------------- Exercise Library ----------------
section("3. Exercise Library API")

r = requests.get(f"{BASE_URL}/exercises/library")
check("GET /exercises/library returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    library = data.get("library", {})
    check("library is grouped object with 'chest'",
          isinstance(library, dict) and "chest" in library, f"keys={list(library.keys())}")
    check("total_exercises is int > 0",
          isinstance(data.get("total_exercises"), int) and data["total_exercises"] > 0,
          str(data.get("total_exercises")))

r = requests.get(f"{BASE_URL}/exercises/library/search?q=bench")
check("GET /exercises/library/search without auth -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE_URL}/exercises/library/search?q=bench", headers=HEADERS)
check("GET /exercises/library/search?q=bench returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    exercises = r.json().get("exercises", [])
    check("search 'bench' returns matches", len(exercises) > 0, f"got {len(exercises)}")
    if exercises:
        all_match = all("bench" in e["name"].lower() for e in exercises)
        check("all results contain 'bench'", all_match, str([e["name"] for e in exercises[:3]]))

r = requests.get(f"{BASE_URL}/exercises/library/search?muscle_group=chest", headers=HEADERS)
check("GET /exercises/library/search?muscle_group=chest returns 200",
      r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    exercises = r.json().get("exercises", [])
    check("muscle_group=chest returns chest exercises", len(exercises) > 0, f"got {len(exercises)}")
    if exercises:
        all_chest = all(e["muscle_group"] == "chest" for e in exercises)
        check("all results have muscle_group=chest", all_chest,
              str([(e["name"], e["muscle_group"]) for e in exercises[:3]]))


# ---------------- Personal Records ----------------
section("4. Personal Records API")

r = requests.get(f"{BASE_URL}/exercises/prs")
check("GET /exercises/prs without auth -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE_URL}/exercises/prs", headers=HEADERS)
check("GET /exercises/prs returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("response has 'records' list",
          isinstance(data.get("records"), list), str(type(data.get("records"))))

r = requests.get(f"{BASE_URL}/exercises/prs/Bench%20Press")
check("GET /exercises/prs/{name} without auth -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE_URL}/exercises/prs/Bench%20Press", headers=HEADERS)
check("GET /exercises/prs/Bench Press returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("response has current_pr key", "current_pr" in data, str(list(data.keys())))
    check("response has one_rm_history list",
          "one_rm_history" in data and isinstance(data["one_rm_history"], list),
          str(list(data.keys())))


# ---------------- Templates ----------------
section("5. Workout Templates API")

r = requests.get(f"{BASE_URL}/templates")
check("GET /templates without auth -> 401", r.status_code == 401, f"got {r.status_code}")

r = requests.get(f"{BASE_URL}/templates", headers=HEADERS)
check("GET /templates returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    presets = data.get("presets", [])
    user_templates = data.get("user_templates", [])
    check("presets has 7 items", len(presets) == 7, f"got {len(presets)}")
    expected_names = {"Push Day", "Pull Day", "Leg Day", "Upper Body",
                      "Lower Body", "Full Body", "PPL"}
    actual_names = {p["name"] for p in presets}
    check("presets contain all expected names",
          expected_names == actual_names,
          f"missing={expected_names - actual_names}, extra={actual_names - expected_names}")
    check("user_templates is list", isinstance(user_templates, list), str(type(user_templates)))

r = requests.post(f"{BASE_URL}/templates",
                  json={"name": "My Custom",
                        "exercises": [{"exercise_name": "Squat", "sets": 3}]},
                  headers=HEADERS)
check("POST /templates returns 200", r.status_code == 200, f"got {r.status_code}: {r.text[:300]}")
created_template_id = None
if r.status_code == 200:
    data = r.json()
    created_template_id = data.get("template_id")
    check("created template has template_id", bool(created_template_id), str(data))
    check("created template name=My Custom",
          data.get("name") == "My Custom", str(data.get("name")))

r = requests.delete(f"{BASE_URL}/templates/nonexistent_xyz_123", headers=HEADERS)
check("DELETE /templates/nonexistent -> 404",
      r.status_code == 404, f"got {r.status_code}: {r.text[:200]}")

if created_template_id:
    r = requests.delete(f"{BASE_URL}/templates/{created_template_id}", headers=HEADERS)
    check("DELETE /templates/{id} returns 200",
          r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")


# ---------------- Plate Calculator ----------------
section("6. Plate Calculator API")

r = requests.get(f"{BASE_URL}/exercises/plate-calculator?weight=100&unit=kg")
check("GET /plate-calculator weight=100 kg returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("total_weight=100", data.get("total_weight") == 100, str(data.get("total_weight")))
    check("barbell_weight=20", data.get("barbell_weight") == 20, str(data.get("barbell_weight")))
    check("per_side=40", data.get("per_side") == 40, str(data.get("per_side")))
    plates = data.get("plates_per_side", [])
    plate_weights = [p["weight"] for p in plates]
    check("plates_per_side weights = [25, 15]",
          plate_weights == [25, 15], f"got {plate_weights}")

r = requests.get(f"{BASE_URL}/exercises/plate-calculator?weight=20&unit=kg")
check("GET /plate-calculator weight=20 kg returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("plates_per_side=[] for 20kg",
          data.get("plates_per_side") == [], str(data.get("plates_per_side")))
    check("per_side=0", data.get("per_side") == 0, str(data.get("per_side")))

r = requests.get(f"{BASE_URL}/exercises/plate-calculator?weight=10&unit=kg")
check("GET /plate-calculator weight=10 kg returns 200 with error key",
      r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("response contains error key for weight<barbell", "error" in data, str(data))

r = requests.get(f"{BASE_URL}/exercises/plate-calculator?weight=135&unit=lbs")
check("GET /plate-calculator weight=135 lbs returns 200", r.status_code == 200, f"got {r.status_code}")
if r.status_code == 200:
    data = r.json()
    check("barbell_weight=45 (lbs)",
          data.get("barbell_weight") == 45, str(data.get("barbell_weight")))
    check("per_side=45 (lbs)", data.get("per_side") == 45, str(data.get("per_side")))
    plates = data.get("plates_per_side", [])
    plate_weights = [p["weight"] for p in plates]
    check("plates=[45] for 135 lbs", plate_weights == [45], f"got {plate_weights}")


# ---------------- Summary ----------------
print("\n" + "=" * 60)
print(f"PASSED: {passed}")
print(f"FAILED: {failed}")
if failures:
    print("\nFailures:")
    for f in failures:
        print(f"  - {f}")
sys.exit(0 if failed == 0 else 1)

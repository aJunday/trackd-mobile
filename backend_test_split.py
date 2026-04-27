"""
Test PUT /api/users/split + onboarding fields (training_days_per_week, split_id)
plus regression smoke checks.
"""
import os
import sys
import requests
import json

BASE = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

results = []
def rec(name, ok, msg=""):
    results.append((name, ok, msg))
    print(f"{'✅' if ok else '❌'} {name} :: {msg}")

# 1. PUT /users/split without auth → 401
try:
    r = requests.put(f"{BASE}/users/split", json={"training_days_per_week": 4, "split_id": "upper_lower_4"})
    rec("PUT /users/split no auth → 401", r.status_code in (401, 403), f"status={r.status_code}, body={r.text[:200]}")
except Exception as e:
    rec("PUT /users/split no auth → 401", False, str(e))

# 2. PUT /users/split with valid token + body
try:
    r = requests.put(f"{BASE}/users/split", headers=HEADERS, json={"training_days_per_week": 4, "split_id": "upper_lower_4"})
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = (r.status_code == 200 and body.get("success") is True
          and body.get("training_days_per_week") == 4 and body.get("split_id") == "upper_lower_4")
    rec("PUT /users/split valid (4, upper_lower_4) → 200", ok, f"status={r.status_code}, body={body}")
except Exception as e:
    rec("PUT /users/split valid (4, upper_lower_4) → 200", False, str(e))

# 3. GET /auth/me reflects 4 / upper_lower_4
try:
    r = requests.get(f"{BASE}/auth/me", headers=HEADERS)
    body = r.json() if r.status_code == 200 else {}
    ok = (r.status_code == 200 and body.get("training_days_per_week") == 4
          and body.get("split_id") == "upper_lower_4")
    rec("GET /auth/me reflects 4 / upper_lower_4", ok, f"status={r.status_code}, days={body.get('training_days_per_week')}, split={body.get('split_id')}")
except Exception as e:
    rec("GET /auth/me reflects 4 / upper_lower_4", False, str(e))

# 4. PUT /users/split with body (3, ppl_3) → 200; verify GET /auth/me
try:
    r = requests.put(f"{BASE}/users/split", headers=HEADERS, json={"training_days_per_week": 3, "split_id": "ppl_3"})
    ok1 = r.status_code == 200 and r.json().get("training_days_per_week") == 3 and r.json().get("split_id") == "ppl_3"
    r2 = requests.get(f"{BASE}/auth/me", headers=HEADERS)
    body2 = r2.json() if r2.status_code == 200 else {}
    ok2 = body2.get("training_days_per_week") == 3 and body2.get("split_id") == "ppl_3"
    rec("PUT /users/split (3, ppl_3) → 200 + GET /auth/me reflects", ok1 and ok2,
        f"put_status={r.status_code}, put_body={r.json()}, me_days={body2.get('training_days_per_week')}, me_split={body2.get('split_id')}")
except Exception as e:
    rec("PUT /users/split (3, ppl_3) → 200 + GET /auth/me reflects", False, str(e))

# 5. PUT /users/split partial body → only split_id updated, days remains 3
try:
    r = requests.put(f"{BASE}/users/split", headers=HEADERS, json={"split_id": "full_body_3"})
    put_body = r.json()
    r2 = requests.get(f"{BASE}/auth/me", headers=HEADERS)
    body2 = r2.json()
    ok = (r.status_code == 200 and put_body.get("split_id") == "full_body_3"
          and "training_days_per_week" not in put_body  # should not echo
          and body2.get("training_days_per_week") == 3
          and body2.get("split_id") == "full_body_3")
    rec("PUT /users/split partial (split_id only) → days remains 3", ok,
        f"put_body={put_body}, me_days={body2.get('training_days_per_week')}, me_split={body2.get('split_id')}")
except Exception as e:
    rec("PUT /users/split partial (split_id only) → days remains 3", False, str(e))

# 6. POST /onboarding/complete with new fields (training_days_per_week=5, split_id=ppl_upper_lower_5)
try:
    payload_full = {
        "name": "Test", "age": 30, "biological_sex": "male", "height_cm": 180, "weight_kg": 80,
        "activity_level": "moderate", "goal_type": "build_muscle", "sport": "general",
        "training_days_per_week": 5, "split_id": "ppl_upper_lower_5"
    }
    r = requests.post(f"{BASE}/onboarding/complete", headers=HEADERS, json=payload_full)
    ok1 = r.status_code == 200
    r2 = requests.get(f"{BASE}/auth/me", headers=HEADERS)
    body2 = r2.json()
    ok2 = (body2.get("training_days_per_week") == 5 and body2.get("split_id") == "ppl_upper_lower_5")
    rec("POST /onboarding/complete with new fields → /auth/me reflects 5 / ppl_upper_lower_5",
        ok1 and ok2,
        f"onb_status={r.status_code}, onb_body_excerpt={str(r.text)[:200]}, me_days={body2.get('training_days_per_week')}, me_split={body2.get('split_id')}")
except Exception as e:
    rec("POST /onboarding/complete with new fields", False, str(e))

# 7. POST /onboarding/complete WITHOUT new fields (backward compat)
try:
    payload_compat = {
        "name": "Test", "age": 30, "biological_sex": "male", "height_cm": 180, "weight_kg": 80,
        "activity_level": "moderate", "goal_type": "build_muscle", "sport": "general"
    }
    r = requests.post(f"{BASE}/onboarding/complete", headers=HEADERS, json=payload_compat)
    rec("POST /onboarding/complete WITHOUT new fields (backward compat) → 200",
        r.status_code == 200, f"status={r.status_code}, body={str(r.text)[:200]}")
except Exception as e:
    rec("POST /onboarding/complete backward compat", False, str(e))

# REGRESSION smoke checks
# (a) GET /templates → 200 with presets length ≥ 7
try:
    r = requests.get(f"{BASE}/templates", headers=HEADERS)
    body = r.json() if r.status_code == 200 else {}
    presets = body.get("presets", [])
    rec("REG: GET /templates → 200 presets ≥ 7",
        r.status_code == 200 and len(presets) >= 7,
        f"status={r.status_code}, presets_len={len(presets)}")
except Exception as e:
    rec("REG: GET /templates → 200 presets ≥ 7", False, str(e))

# (b) GET /exercises/details?name=Bench Press → 200 source='free-exercise-db'
try:
    r = requests.get(f"{BASE}/exercises/details", params={"name": "Bench Press"})
    body = r.json() if r.status_code == 200 else {}
    rec("REG: GET /exercises/details name=Bench Press → free-exercise-db",
        r.status_code == 200 and body.get("source") == "free-exercise-db",
        f"status={r.status_code}, source={body.get('source')}, matched={body.get('matched_name')}")
except Exception as e:
    rec("REG: GET /exercises/details", False, str(e))

# (c) GET /coach/insights with auth → 200 with insights array
try:
    r = requests.get(f"{BASE}/coach/insights", headers=HEADERS)
    body = r.json() if r.status_code == 200 else {}
    rec("REG: GET /coach/insights → 200 with insights array",
        r.status_code == 200 and isinstance(body.get("insights"), list),
        f"status={r.status_code}, insights_type={type(body.get('insights')).__name__}, count={body.get('count')}")
except Exception as e:
    rec("REG: GET /coach/insights", False, str(e))

# Print summary
print("\n=== SUMMARY ===")
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"{passed}/{total} passed")
for name, ok, msg in results:
    if not ok:
        print(f"FAIL: {name} :: {msg}")

sys.exit(0 if passed == total else 1)

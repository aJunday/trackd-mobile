"""
Re-test TRACKD User Training Split task.

Tests the 2 bug fixes:
1. User Pydantic model now declares training_days_per_week + split_id
   so GET /auth/me reflects them.
2. POST /api/onboarding/complete only writes training_days_per_week /
   split_id to update_data when the request includes non-None values
   (backward compat: omitting them preserves existing values).
"""
import sys
import requests

BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"
SESSION_TOKEN = "test_session_trackd_1777237904201"
AUTH = {"Authorization": f"Bearer {SESSION_TOKEN}"}


def _dump(resp):
    try:
        return resp.json()
    except Exception:
        return resp.text


results = []


def record(name, passed, detail=""):
    prefix = "PASS" if passed else "FAIL"
    print(f"[{prefix}] {name} — {detail}")
    results.append((name, passed, detail))


def get_me():
    r = requests.get(f"{BASE_URL}/auth/me", headers=AUTH, timeout=20)
    r.raise_for_status()
    return r.json()


def main():
    # S1: no auth → 401
    r = requests.put(
        f"{BASE_URL}/users/split",
        json={"training_days_per_week": 4, "split_id": "upper_lower_4"},
        timeout=20,
    )
    record("S1: PUT /users/split no auth → 401", r.status_code == 401,
           f"status={r.status_code}")

    # Precheck
    try:
        me = get_me()
        print(f"Auth OK user_id={me.get('user_id')} email={me.get('email')}")
    except Exception as e:
        record("Auth precheck", False, f"GET /auth/me failed: {e}")
        print_summary()
        return

    # S2: {4, upper_lower_4}
    body2 = {"training_days_per_week": 4, "split_id": "upper_lower_4"}
    r = requests.put(f"{BASE_URL}/users/split", headers=AUTH, json=body2, timeout=20)
    d = _dump(r)
    ok = (r.status_code == 200 and isinstance(d, dict)
          and d.get("success") is True
          and d.get("training_days_per_week") == 4
          and d.get("split_id") == "upper_lower_4")
    record("S2a: PUT {4,upper_lower_4} → 200 + echo", ok,
           f"status={r.status_code} body={d}")

    me = get_me()
    ok = (me.get("training_days_per_week") == 4
          and me.get("split_id") == "upper_lower_4")
    record("S2b: /auth/me reflects 4 + upper_lower_4", ok,
           f"days={me.get('training_days_per_week')} split={me.get('split_id')}")

    # S3: {3, ppl_3}
    body3 = {"training_days_per_week": 3, "split_id": "ppl_3"}
    r = requests.put(f"{BASE_URL}/users/split", headers=AUTH, json=body3, timeout=20)
    d = _dump(r)
    ok = (r.status_code == 200 and d.get("training_days_per_week") == 3
          and d.get("split_id") == "ppl_3")
    record("S3a: PUT {3,ppl_3} → 200", ok, f"status={r.status_code} body={d}")

    me = get_me()
    ok = (me.get("training_days_per_week") == 3
          and me.get("split_id") == "ppl_3")
    record("S3b: /auth/me shows 3 + ppl_3", ok,
           f"days={me.get('training_days_per_week')} split={me.get('split_id')}")

    # S4: partial {split_id only}
    body4 = {"split_id": "full_body_3"}
    r = requests.put(f"{BASE_URL}/users/split", headers=AUTH, json=body4, timeout=20)
    d = _dump(r)
    ok = r.status_code == 200
    record("S4a: PUT partial {split_id=full_body_3} → 200", ok,
           f"status={r.status_code} body={d}")

    me = get_me()
    ok = (me.get("training_days_per_week") == 3
          and me.get("split_id") == "full_body_3")
    record("S4b: /auth/me days==3 (unchanged), split==full_body_3", ok,
           f"days={me.get('training_days_per_week')} split={me.get('split_id')}")

    # S5: onboarding WITH new fields
    onb5 = {
        "name": "Test", "age": 30, "biological_sex": "male",
        "height_cm": 180, "weight_kg": 80,
        "activity_level": "moderately_active", "goal_type": "build_muscle",
        "sport": "general",
        "training_days_per_week": 5, "split_id": "ppl_upper_lower_5",
    }
    r = requests.post(f"{BASE_URL}/onboarding/complete", headers=AUTH, json=onb5, timeout=30)
    d = _dump(r)
    ok = r.status_code == 200 and d.get("success") is True
    record("S5a: POST /onboarding/complete w/ fields → 200", ok,
           f"status={r.status_code}")

    me = get_me()
    ok = (me.get("training_days_per_week") == 5
          and me.get("split_id") == "ppl_upper_lower_5")
    record("S5b: /auth/me shows 5 + ppl_upper_lower_5", ok,
           f"days={me.get('training_days_per_week')} split={me.get('split_id')}")

    # S6: onboarding OMITTING new fields — must NOT overwrite
    onb6 = {
        "name": "Test", "age": 30, "biological_sex": "male",
        "height_cm": 180, "weight_kg": 80,
        "activity_level": "moderately_active", "goal_type": "build_muscle",
        "sport": "general",
    }
    r = requests.post(f"{BASE_URL}/onboarding/complete", headers=AUTH, json=onb6, timeout=30)
    ok = r.status_code == 200
    record("S6a: POST /onboarding/complete w/o fields → 200", ok,
           f"status={r.status_code}")

    me = get_me()
    ok = (me.get("training_days_per_week") == 5
          and me.get("split_id") == "ppl_upper_lower_5")
    record("S6b: /auth/me STILL 5 + ppl_upper_lower_5 (no overwrite)", ok,
           f"days={me.get('training_days_per_week')} split={me.get('split_id')}")

    print_summary()


def print_summary():
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    for name, p, d in results:
        print(f"  {'PASS' if p else 'FAIL'} — {name}")
    print(f"\n{passed}/{total} assertions passed")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()

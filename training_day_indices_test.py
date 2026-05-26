"""Test training_day_indices addition (Addition 4)."""
import os
import sys
import json
import requests

BASE = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def show(label, r):
    try:
        body = r.json()
    except Exception:
        body = r.text
    print(f"--- {label}: HTTP {r.status_code}")
    print(json.dumps(body, indent=2, default=str))
    return body


def main():
    results = []

    # Scenario (a)
    payload_a = {"training_days_per_week": 3, "training_day_indices": [0, 2, 4], "split_id": "ppl_3"}
    r = requests.put(f"{BASE}/users/split", headers=H, json=payload_a)
    body_a = show("(a) PUT /users/split", r)
    me = show("(a) GET /auth/me", requests.get(f"{BASE}/auth/me", headers=H))
    pass_a = (
        r.status_code == 200
        and me.get("training_days_per_week") == 3
        and me.get("training_day_indices") == [0, 2, 4]
        and me.get("split_id") == "ppl_3"
    )
    results.append(("Scenario (a)", pass_a))

    # Scenario (b)
    payload_b = {"training_day_indices": [1, 3, 5, 6]}
    r = requests.put(f"{BASE}/users/split", headers=H, json=payload_b)
    body_b = show("(b) PUT /users/split (only indices)", r)
    me = show("(b) GET /auth/me", requests.get(f"{BASE}/auth/me", headers=H))
    pass_b = (
        r.status_code == 200
        and me.get("training_day_indices") == [1, 3, 5, 6]
        and me.get("split_id") == "ppl_3"  # preserved
    )
    results.append(("Scenario (b)", pass_b))

    # Scenario (c): POST onboarding/complete with all required fields + training_day_indices
    onboarding_payload = {
        "name": "Alex Tester",
        "age": 30,
        "biological_sex": "male",
        "height_cm": 180.0,
        "weight_kg": 80.0,
        "activity_level": "moderately_active",
        "goal_type": "build_muscle",
        "sport": "powerlifting",
        "training_day_indices": [1, 2, 3, 4],
    }
    r = requests.post(f"{BASE}/onboarding/complete", headers=H, json=onboarding_payload)
    body_c = show("(c) POST /onboarding/complete (with indices)", r)
    me = show("(c) GET /auth/me", requests.get(f"{BASE}/auth/me", headers=H))
    pass_c = r.status_code == 200 and me.get("training_day_indices") == [1, 2, 3, 4]
    results.append(("Scenario (c)", pass_c))

    # Scenario (d): POST onboarding/complete WITHOUT training_day_indices → preserved
    onboarding_payload_no_indices = {
        "name": "Alex Tester",
        "age": 30,
        "biological_sex": "male",
        "height_cm": 180.0,
        "weight_kg": 80.0,
        "activity_level": "moderately_active",
        "goal_type": "build_muscle",
        "sport": "powerlifting",
    }
    r = requests.post(f"{BASE}/onboarding/complete", headers=H, json=onboarding_payload_no_indices)
    body_d = show("(d) POST /onboarding/complete (no indices)", r)
    me = show("(d) GET /auth/me", requests.get(f"{BASE}/auth/me", headers=H))
    pass_d = r.status_code == 200 and me.get("training_day_indices") == [1, 2, 3, 4]
    results.append(("Scenario (d)", pass_d))

    # Scenario (e): restore clean state
    restore = {"training_days_per_week": 4, "training_day_indices": [0, 1, 3, 4], "split_id": "upper_lower_4"}
    r = requests.put(f"{BASE}/users/split", headers=H, json=restore)
    body_e = show("(e) PUT /users/split (restore)", r)
    me = show("(e) GET /auth/me", requests.get(f"{BASE}/auth/me", headers=H))
    pass_e = (
        r.status_code == 200
        and me.get("training_days_per_week") == 4
        and me.get("training_day_indices") == [0, 1, 3, 4]
        and me.get("split_id") == "upper_lower_4"
    )
    results.append(("Scenario (e)", pass_e))

    print("\n=========== SUMMARY ===========")
    for label, ok in results:
        print(f"{'PASS' if ok else 'FAIL'}  {label}")
    all_ok = all(ok for _, ok in results)
    print(("\nALL PASS" if all_ok else "\nSOME FAILED"))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()

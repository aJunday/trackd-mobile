"""
Re-test ONLY the 2 backend endpoints that were patched:
  FIX 1: POST /api/pantry/cook-meal — pantry deduction (item_name vs name)
  FIX 2: GET  /api/coach/calorie-adjustment — 22d cutoff
        + POST /api/coach/apply-calorie-adjustment

Auth: Bearer test_session_trackd_1777237904201
"""

import os
import sys
import json
import time
from datetime import datetime, timezone, timedelta

import requests
from pymongo import MongoClient

# Use the public preview URL (the same backend runs on 0.0.0.0:8001 inside the container).
BASE = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]

USER_ID = "test-user-trackd-1777237904201"

results = []  # list of (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name}  {detail}")


def cleanup_pantry():
    db.pantry.delete_many({"user_id": USER_ID})


def cleanup_measurements():
    db.measurements.delete_many({"user_id": USER_ID})


# --------------------------------------------------------------------------
# FIX 1: AI Chef Pantry Deduction
# --------------------------------------------------------------------------

def _get_pantry_items():
    r = requests.get(f"{BASE}/pantry", headers=HEADERS)
    if r.status_code != 200:
        return None
    body = r.json()
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        return body.get("items") or body.get("pantry") or []
    return []


def fix1_test1_dry_run_hit():
    cleanup_pantry()
    # Create chicken breast 500g
    r = requests.post(
        f"{BASE}/pantry",
        headers=HEADERS,
        json={"item_name": "chicken breast", "quantity": 500, "unit": "g"},
    )
    if r.status_code != 200:
        record("FIX1.1 dry_run hit", False, f"create {r.status_code} {r.text[:200]}")
        return
    payload = {
        "meal_name": "Test",
        "ingredients": ["150g chicken breast"],
        "macros": {"calories": 100, "protein": 10, "carbs": 10, "fats": 5},
        "dry_run": True,
    }
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HEADERS, json=payload)
    if r.status_code != 200:
        record("FIX1.1 dry_run hit", False, f"status {r.status_code}: {r.text[:300]}")
        return
    data = r.json()
    matched = data.get("matched", [])
    unmatched = data.get("unmatched", [])
    if len(matched) != 1:
        record("FIX1.1 dry_run hit", False,
               f"matched len={len(matched)}; unmatched={unmatched}; resp={json.dumps(data)[:400]}")
        return
    m = matched[0]
    ok = (
        m.get("pantry_name") == "chicken breast"
        and float(m.get("available")) == 500
        and float(m.get("deduct")) == 150
        and float(m.get("after")) == 350
    )
    record("FIX1.1 dry_run hit", ok, f"matched={m}")


def fix1_test2_apply_deducts():
    # pantry was created at 500g by test 1; dry_run didn't modify
    payload = {
        "meal_name": "Test",
        "ingredients": ["150g chicken breast"],
        "macros": {"calories": 100, "protein": 10, "carbs": 10, "fats": 5},
        "dry_run": False,
    }
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HEADERS, json=payload)
    if r.status_code != 200:
        record("FIX1.2 apply deducts", False, f"status {r.status_code}: {r.text[:300]}")
        return
    data = r.json()
    if not data.get("matched"):
        record("FIX1.2 apply deducts", False, f"no matched: {data}")
        return
    items = _get_pantry_items()
    if items is None:
        record("FIX1.2 apply deducts", False, "GET /pantry failed")
        return
    chicken = next((i for i in items if (i.get("item_name") or "").lower() == "chicken breast"), None)
    if not chicken:
        record("FIX1.2 apply deducts", False, f"no chicken in pantry; items={items}")
        return
    ok = float(chicken.get("quantity")) == 350
    record("FIX1.2 apply deducts", ok, f"chicken qty={chicken.get('quantity')} (expected 350)")


def fix1_test3_cap_at_zero_delete():
    cleanup_pantry()
    r = requests.post(
        f"{BASE}/pantry",
        headers=HEADERS,
        json={"item_name": "chicken breast", "quantity": 10, "unit": "g"},
    )
    if r.status_code != 200:
        record("FIX1.3 cap+delete", False, f"create {r.status_code}")
        return
    payload = {
        "meal_name": "Test",
        "ingredients": ["100g chicken breast"],
        "macros": {"calories": 100, "protein": 10, "carbs": 10, "fats": 5},
        "dry_run": False,
    }
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HEADERS, json=payload)
    if r.status_code != 200:
        record("FIX1.3 cap+delete", False, f"cook-meal {r.status_code}: {r.text[:300]}")
        return
    items = _get_pantry_items() or []
    chicken = next((i for i in items if (i.get("item_name") or "").lower() == "chicken breast"), None)
    ok = chicken is None
    record("FIX1.3 cap+delete", ok, f"chicken still present? {chicken}")


def fix1_test4_unmatched():
    cleanup_pantry()
    payload = {
        "meal_name": "Test",
        "ingredients": ["300g martian-meat"],
        "macros": {"calories": 100, "protein": 10, "carbs": 10, "fats": 5},
        "dry_run": False,
    }
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HEADERS, json=payload)
    if r.status_code != 200:
        record("FIX1.4 unmatched", False, f"status {r.status_code}: {r.text[:300]}")
        return
    data = r.json()
    matched = data.get("matched", [])
    unmatched = data.get("unmatched", [])
    ok = (
        len(matched) == 0
        and len(unmatched) == 1
        and "martian" in (unmatched[0].get("parsed_name", "").lower())
    )
    record("FIX1.4 unmatched", ok, f"matched={matched}, unmatched={unmatched}")


# --------------------------------------------------------------------------
# FIX 2: Calorie Goal Auto-Adjustment
# --------------------------------------------------------------------------

def _seed_two_measurements(weight_old, weight_now, days_ago_old=21):
    """Insert two measurements directly into Mongo."""
    cleanup_measurements()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    old = now - timedelta(days=days_ago_old)
    docs = [
        {
            "measurement_id": f"bm_{int(time.time()*1000)}_a",
            "user_id": USER_ID,
            "date": old.strftime("%Y-%m-%d"),
            "weight_kg": float(weight_old),
            "created_at": old,
        },
        {
            "measurement_id": f"bm_{int(time.time()*1000)}_b",
            "user_id": USER_ID,
            "date": now.strftime("%Y-%m-%d"),
            "weight_kg": float(weight_now),
            "created_at": now,
        },
    ]
    db.measurements.insert_many(docs)


def _set_goal_type(goal_type):
    db.users.update_one({"user_id": USER_ID}, {"$set": {"goal_type": goal_type}})


def fix2_test1_stalled_lose_fat():
    _set_goal_type("lose_fat")
    _seed_two_measurements(80.0, 80.1, days_ago_old=21)
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HEADERS)
    if r.status_code != 200:
        record("FIX2.1 stalled lose_fat", False, f"status {r.status_code}: {r.text[:300]}")
        return
    data = r.json()
    sug = data.get("suggestion")
    if not sug:
        record("FIX2.1 stalled lose_fat", False, f"suggestion null: {data}")
        return
    ok = sug.get("direction") == "reduce" and sug.get("goal_type") == "lose_fat"
    record("FIX2.1 stalled lose_fat", ok,
           f"direction={sug.get('direction')} delta={sug.get('delta_kg_21d')}")


def fix2_test2_stalled_build_muscle():
    _set_goal_type("build_muscle")
    _seed_two_measurements(80.0, 80.1, days_ago_old=21)
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HEADERS)
    if r.status_code != 200:
        record("FIX2.2 stalled build_muscle", False, f"status {r.status_code}: {r.text[:300]}")
        return
    sug = r.json().get("suggestion")
    if not sug:
        record("FIX2.2 stalled build_muscle", False, f"suggestion null: {r.json()}")
        return
    ok = sug.get("direction") == "increase" and sug.get("goal_type") == "build_muscle"
    record("FIX2.2 stalled build_muscle", ok,
           f"direction={sug.get('direction')} proposed={sug.get('proposed_calories')}")


def fix2_test3_maintain_fluctuating():
    _set_goal_type("maintain")
    _seed_two_measurements(80.0, 82.0, days_ago_old=21)
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HEADERS)
    if r.status_code != 200:
        record("FIX2.3 maintain fluctuating", False, f"status {r.status_code}")
        return
    sug = r.json().get("suggestion")
    ok = sug is not None
    record("FIX2.3 maintain fluctuating", ok, f"sug.direction={sug.get('direction') if sug else None}")


def fix2_test4_maintain_stable():
    _set_goal_type("maintain")
    _seed_two_measurements(80.0, 80.5, days_ago_old=21)
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HEADERS)
    if r.status_code != 200:
        record("FIX2.4 maintain stable", False, f"status {r.status_code}")
        return
    sug = r.json().get("suggestion")
    ok = sug is None
    record("FIX2.4 maintain stable", ok, f"sug={sug}")


def fix2_test5_not_enough_span():
    _set_goal_type("lose_fat")
    _seed_two_measurements(80.0, 80.1, days_ago_old=5)
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HEADERS)
    if r.status_code != 200:
        record("FIX2.5 not enough span", False, f"status {r.status_code}")
        return
    sug = r.json().get("suggestion")
    ok = sug is None
    record("FIX2.5 not enough span", ok, f"sug={sug}")


def fix2_test6_apply_persisted():
    payload = {
        "calories": 1800, "protein": 140, "carbs": 180, "fats": 60,
        "tdee": 2300, "weight_kg": 80,
    }
    r = requests.post(f"{BASE}/coach/apply-calorie-adjustment", headers=HEADERS, json=payload)
    if r.status_code != 200:
        record("FIX2.6 apply persisted", False, f"status {r.status_code}: {r.text[:300]}")
        return
    me = requests.get(f"{BASE}/auth/me", headers=HEADERS)
    if me.status_code != 200:
        record("FIX2.6 apply persisted", False, f"/auth/me {me.status_code}")
        return
    u = me.json()
    ok = (
        int(u.get("goal_calories")) == 1800
        and int(u.get("goal_protein")) == 140
        and int(u.get("goal_carbs")) == 180
        and int(u.get("goal_fats")) == 60
        and float(u.get("tdee")) == 2300.0
        and float(u.get("weight_kg")) == 80.0
    )
    record("FIX2.6 apply persisted", ok,
           f"cal={u.get('goal_calories')} p={u.get('goal_protein')} c={u.get('goal_carbs')} f={u.get('goal_fats')} tdee={u.get('tdee')} wkg={u.get('weight_kg')}")


def main():
    print("=" * 70)
    print("FIX 1: Pantry Deduction (POST /api/pantry/cook-meal)")
    print("=" * 70)
    fix1_test1_dry_run_hit()
    fix1_test2_apply_deducts()
    fix1_test3_cap_at_zero_delete()
    fix1_test4_unmatched()

    print()
    print("=" * 70)
    print("FIX 2: Calorie Goal Auto-Adjustment (/api/coach/...)")
    print("=" * 70)
    # Snapshot goal_type so we can restore later (and target values won't drift after test 6)
    fix2_test1_stalled_lose_fat()
    fix2_test2_stalled_build_muscle()
    fix2_test3_maintain_fluctuating()
    fix2_test4_maintain_stable()
    fix2_test5_not_enough_span()
    fix2_test6_apply_persisted()

    # Final cleanup
    cleanup_pantry()
    cleanup_measurements()

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, _ in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\nTOTAL: {passed} passed, {failed} failed (of {len(results)})")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()

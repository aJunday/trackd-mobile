"""
Backend tests for 3 NEW TRACKD feature groups:
  1. AI Chef Pantry Deduction  (POST /api/pantry/cook-meal)
  2. Calorie Goal Auto-Adjustment (GET/POST /api/coach/...)
  3. Shopping List CRUD (/api/shopping-list/...)
"""

import os, sys, json, uuid, asyncio
from datetime import datetime, timezone, timedelta

import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE = os.environ.get(
    "TEST_BACKEND_URL",
    "https://fitness-command-7.preview.emergentagent.com",
).rstrip("/") + "/api"
TOKEN = "test_session_trackd_1777237904201"
USER_ID = "test-user-trackd-1777237904201"
HDR = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "test_database")

results = []  # (group, name, ok, info)


def log(group, name, ok, info=""):
    tag = "✅" if ok else "❌"
    print(f"{tag} [{group}] {name}: {info}")
    results.append((group, name, ok, info))


async def mongo():
    client = AsyncIOMotorClient(MONGO_URL)
    return client, client[DB_NAME]


async def reset_pantry():
    c, d = await mongo()
    await d.pantry.delete_many({"user_id": USER_ID})
    c.close()


async def reset_shopping():
    c, d = await mongo()
    await d.shopping_list.delete_many({"user_id": USER_ID})
    c.close()


async def reset_measurements():
    c, d = await mongo()
    await d.measurements.delete_many({"user_id": USER_ID})
    c.close()


async def reset_meals_today():
    c, d = await mongo()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await d.meals.delete_many({"user_id": USER_ID, "date": today})
    c.close()


async def seed_measurements(pairs):
    c, d = await mongo()
    docs = []
    for w, days_ago in pairs:
        ts = datetime.now(timezone.utc) - timedelta(days=days_ago)
        docs.append({
            "measurement_id": f"bm_{uuid.uuid4().hex[:12]}",
            "user_id": USER_ID,
            "date": ts.strftime("%Y-%m-%d"),
            "weight_kg": float(w),
            "created_at": ts.replace(tzinfo=None),
        })
    if docs:
        await d.measurements.insert_many(docs)
    c.close()


async def set_user_field(**kwargs):
    c, d = await mongo()
    await d.users.update_one({"user_id": USER_ID}, {"$set": kwargs})
    c.close()


async def ensure_user_profile():
    c, d = await mongo()
    user = await d.users.find_one({"user_id": USER_ID})
    if not user:
        raise RuntimeError("Test user not found")
    patch = {}
    if not user.get("height_cm"): patch["height_cm"] = 180.0
    if not user.get("age"): patch["age"] = 30
    if not user.get("biological_sex"): patch["biological_sex"] = "male"
    if not user.get("activity_level"): patch["activity_level"] = "moderately_active"
    if not user.get("goal_calories"): patch["goal_calories"] = 2500
    if not user.get("tdee"): patch["tdee"] = 2800.0
    if patch:
        await d.users.update_one({"user_id": USER_ID}, {"$set": patch})
    c.close()


async def fetch_pantry_qty(item_id):
    c, d = await mongo()
    doc = await d.pantry.find_one({"item_id": item_id})
    c.close()
    return None if not doc else doc.get("quantity")


async def fetch_meal_today(meal_name):
    c, d = await mongo()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = await d.meals.find_one({"user_id": USER_ID, "date": today, "items.name": meal_name})
    c.close()
    return doc


def create_pantry_item(item_name, quantity, unit="g"):
    r = requests.post(f"{BASE}/pantry", headers=HDR, json={
        "item_name": item_name, "quantity": float(quantity), "unit": unit,
    })
    r.raise_for_status()
    return r.json()


# =============================================================================
# GROUP 1
# =============================================================================
def test_group1_cook_meal():
    grp = "G1-CookMeal"
    payload_template = {
        "meal_name": "Chicken Rice Bowl",
        "ingredients": ["150g chicken breast", "1 cup rice", "2 tbsp olive oil", "salt"],
        "macros": {"calories": 550, "protein": 45, "carbs": 60, "fats": 12},
        "meal_type": "lunch",
        "dry_run": True,
    }

    asyncio.run(reset_pantry())
    asyncio.run(reset_meals_today())

    # T4: no pantry → all unmatched
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HDR, json=payload_template)
    if r.status_code != 200:
        log(grp, "no-pantry dry-run reachable", False, f"status {r.status_code} body={r.text[:200]}")
        return
    body = r.json()
    ok = (body.get("success") is True and body.get("dry_run") is True
          and body.get("matched") == [] and len(body.get("unmatched", [])) >= 3)
    log(grp, "T4 empty pantry → all unmatched", ok,
        f"matched={len(body.get('matched',[]))} unmatched={len(body.get('unmatched',[]))}")

    if body.get("unmatched"):
        u0 = body["unmatched"][0]
        ok_shape = all(k in u0 for k in ("raw", "parsed_name", "quantity", "unit"))
        log(grp, "unmatched item shape (raw/parsed_name/quantity/unit)", ok_shape, f"sample={u0}")

    # T3: empty ingredients
    p = dict(payload_template, ingredients=[])
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HDR, json=p)
    ok = (r.status_code == 200
          and r.json().get("matched") == [] and r.json().get("unmatched") == [])
    log(grp, "T3 empty ingredients list", ok, f"status={r.status_code} body={r.text[:150]}")

    # T1: dry-run with pantry → expect matches
    pi_chicken = create_pantry_item("chicken breast", 500, "g")
    create_pantry_item("rice", 1000, "g")
    create_pantry_item("olive oil", 500, "ml")

    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HDR, json=payload_template)
    body = r.json()
    matched = body.get("matched", [])
    unmatched = body.get("unmatched", [])
    log(grp, "T1 dry-run with pantry returns lists",
        r.status_code == 200 and isinstance(matched, list),
        f"matched={len(matched)} unmatched={len(unmatched)}")

    # parsing check
    chicken_hit = next((m for m in matched if m.get("parsed_name") == "chicken breast"), None)
    ok_p = chicken_hit is not None and chicken_hit.get("deduct") == 150
    log(grp, "T1 parse '150g chicken breast' → 150g + matched", ok_p,
        f"hit={json.dumps(chicken_hit, default=str)}")

    if matched:
        m0 = matched[0]
        req_keys = ("raw", "parsed_name", "pantry_item_id", "pantry_name",
                    "pantry_unit", "available", "deduct", "after")
        missing = [k for k in req_keys if k not in m0]
        log(grp, "T1 matched item has all required fields", missing == [],
            f"missing={missing}")
        # The bug check — server reads p.get('name') but PantryItem stores 'item_name'
        log(grp, "T1 matched.pantry_name populated (not None)", bool(m0.get("pantry_name")),
            f"pantry_name={m0.get('pantry_name')!r}")

    # T2: apply path
    p_apply = dict(payload_template, dry_run=False)
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HDR, json=p_apply)
    body = r.json()
    ok_apply = r.status_code == 200 and body.get("success") and body.get("meal_logged")
    log(grp, "T2 apply: success + meal_logged=true", bool(ok_apply),
        f"status={r.status_code} keys={list(body.keys())}")

    qty = asyncio.run(fetch_pantry_qty(pi_chicken["item_id"]))
    ok_deduct = qty is not None and abs(qty - 350.0) < 0.5
    log(grp, "T2 pantry deducted chicken 500→350g", ok_deduct, f"actual_qty={qty}")

    meal = asyncio.run(fetch_meal_today("Chicken Rice Bowl"))
    ok_meal = meal is not None and float(meal.get("total_calories") or 0) == 550
    log(grp, "T2 meal inserted into today's meals (550 cal)", ok_meal,
        f"meal_id={meal.get('meal_id') if meal else None}")

    r = requests.get(f"{BASE}/nutrition/today", headers=HDR)
    if r.status_code == 200:
        nbody = r.json()
        consumed_cal = (nbody.get("consumed", {}).get("calories")
                        if isinstance(nbody.get("consumed"), dict)
                        else nbody.get("total_calories"))
        log(grp, "T2 GET /nutrition/today shows consumed calories>0",
            (consumed_cal or 0) > 0, f"calories={consumed_cal}")
    else:
        log(grp, "T2 GET /nutrition/today reachable", False, f"status={r.status_code}")

    # T5: deletion when qty hits 0
    asyncio.run(reset_pantry())
    pi_chicken_small = create_pantry_item("chicken breast", 10, "g")
    p_small = {
        "meal_name": "Small Chicken Snack",
        "ingredients": ["100g chicken breast"],
        "macros": {"calories": 50, "protein": 5, "carbs": 0, "fats": 1},
        "meal_type": "snack", "dry_run": False,
    }
    r = requests.post(f"{BASE}/pantry/cook-meal", headers=HDR, json=p_small)
    body = r.json()
    matched = body.get("matched", [])
    ok_cap = bool(matched) and matched[0].get("deduct") == 10 and matched[0].get("after") == 0
    log(grp, "T5 deduction capped at available (10g) — after=0", ok_cap,
        f"matched[0]={json.dumps(matched[0] if matched else {}, default=str)}")
    qty2 = asyncio.run(fetch_pantry_qty(pi_chicken_small["item_id"]))
    log(grp, "T5 pantry item deleted when qty hits 0", qty2 is None,
        f"qty after apply = {qty2}")

    asyncio.run(reset_pantry())
    asyncio.run(reset_meals_today())


# =============================================================================
# GROUP 2
# =============================================================================
def test_group2_calorie_adjustment():
    grp = "G2-CalorieAdj"
    asyncio.run(ensure_user_profile())

    # T1: no measurements → null
    asyncio.run(reset_measurements())
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HDR)
    ok = r.status_code == 200 and r.json().get("suggestion") is None
    log(grp, "T1 no measurements → suggestion null", ok,
        f"status={r.status_code} body={r.text[:160]}")

    # T2: stalled lose_fat
    asyncio.run(set_user_field(goal_type="lose_fat", goal_calories=2300, tdee=2700.0))
    asyncio.run(reset_measurements())
    asyncio.run(seed_measurements([(80.1, 21), (80.0, 0)]))
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HDR)
    sugg = r.json().get("suggestion") if r.status_code == 200 else None
    ok = (sugg and sugg.get("direction") == "reduce"
          and sugg.get("goal_type") == "lose_fat"
          and (sugg.get("proposed_calories") or 0) < (sugg.get("new_tdee") or 0))
    log(grp, "T2 stalled lose_fat → reduce", bool(ok),
        f"sugg={json.dumps(sugg, default=str)[:240] if sugg else r.text[:200]}")

    # T3: stalled build_muscle
    asyncio.run(set_user_field(goal_type="build_muscle", goal_calories=3000, tdee=2700.0))
    asyncio.run(reset_measurements())
    asyncio.run(seed_measurements([(80.0, 21), (80.0, 0)]))
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HDR)
    sugg = r.json().get("suggestion") if r.status_code == 200 else None
    ok = (sugg and sugg.get("direction") == "increase"
          and (sugg.get("proposed_calories") or 0) > (sugg.get("new_tdee") or 0))
    log(grp, "T3 stalled build_muscle → increase, proposed > new_tdee", bool(ok),
        f"sugg={json.dumps(sugg, default=str)[:240] if sugg else r.text[:200]}")

    # T4: maintain fluctuating (>1kg)
    asyncio.run(set_user_field(goal_type="maintain", goal_calories=2700, tdee=2700.0))
    asyncio.run(reset_measurements())
    asyncio.run(seed_measurements([(80.0, 21), (82.0, 0)]))
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HDR)
    sugg = r.json().get("suggestion") if r.status_code == 200 else None
    ok = (sugg and sugg.get("direction") in ("reduce", "increase"))
    log(grp, "T4 maintain w/ >1kg drift → suggestion populated", bool(ok),
        f"direction={sugg.get('direction') if sugg else None} delta={sugg.get('delta_kg_21d') if sugg else None}")

    # T5: maintain stable
    asyncio.run(set_user_field(goal_type="maintain"))
    asyncio.run(reset_measurements())
    asyncio.run(seed_measurements([(80.0, 21), (80.5, 0)]))
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HDR)
    ok = r.status_code == 200 and r.json().get("suggestion") is None
    log(grp, "T5 maintain stable (<1kg drift) → suggestion null", ok,
        f"body={r.text[:200]}")

    # T6: not enough span
    asyncio.run(set_user_field(goal_type="lose_fat"))
    asyncio.run(reset_measurements())
    asyncio.run(seed_measurements([(80.0, 5), (80.0, 0)]))
    r = requests.get(f"{BASE}/coach/calorie-adjustment", headers=HDR)
    ok = r.status_code == 200 and r.json().get("suggestion") is None
    log(grp, "T6 span < 18 days → suggestion null", ok, f"body={r.text[:200]}")

    # T7: apply
    apply_body = {"calories": 1800, "protein": 140, "carbs": 180, "fats": 60,
                  "tdee": 2300, "weight_kg": 80}
    r = requests.post(f"{BASE}/coach/apply-calorie-adjustment", headers=HDR, json=apply_body)
    ok = r.status_code == 200 and r.json().get("success") is True
    log(grp, "T7 POST /coach/apply-calorie-adjustment returns success", ok,
        f"status={r.status_code} body={r.text[:200]}")
    r = requests.get(f"{BASE}/auth/me", headers=HDR)
    me = r.json() if r.status_code == 200 else {}
    ok = me.get("goal_calories") == 1800 and me.get("goal_protein") == 140
    log(grp, "T7 GET /auth/me reflects goal_calories=1800/protein=140", ok,
        f"goal_calories={me.get('goal_calories')} goal_protein={me.get('goal_protein')}")

    asyncio.run(reset_measurements())
    asyncio.run(set_user_field(goal_calories=2500, goal_protein=160, goal_carbs=300,
                               goal_fats=80, goal_type="build_muscle"))


# =============================================================================
# GROUP 3
# =============================================================================
def test_group3_shopping_list():
    grp = "G3-Shopping"
    asyncio.run(reset_shopping())

    # T1
    r = requests.post(f"{BASE}/shopping-list", headers=HDR, json={"name": "tomatoes"})
    ok = r.status_code == 200 and r.json().get("success")
    log(grp, "T1 POST add 'tomatoes'", bool(ok), f"status={r.status_code} body={r.text[:200]}")
    tomato_id = r.json().get("item", {}).get("item_id")

    r = requests.get(f"{BASE}/shopping-list", headers=HDR)
    items = r.json().get("items", [])
    ok = r.status_code == 200 and len(items) == 1 and items[0].get("name") == "tomatoes"
    log(grp, "T1 GET list has 1 item ('tomatoes')", ok, f"items_count={len(items)}")

    # T2
    r = requests.post(f"{BASE}/shopping-list/bulk", headers=HDR, json={
        "items": [{"name": "onions"}, {"name": "garlic"}, {"name": "tomatoes"}]
    })
    body = r.json()
    ok = r.status_code == 200 and body.get("added") == 2
    log(grp, "T2 bulk add dedupes 'tomatoes' (added=2)", ok,
        f"status={r.status_code} body={r.text[:200]}")
    items = requests.get(f"{BASE}/shopping-list", headers=HDR).json().get("items", [])
    log(grp, "T2 after bulk: 3 items in list", len(items) == 3,
        f"items={[i.get('name') for i in items]}")

    # T3
    r = requests.put(f"{BASE}/shopping-list/{tomato_id}/toggle", headers=HDR)
    ok = r.status_code == 200 and r.json().get("checked") is True
    log(grp, "T3 toggle tomatoes → checked=true", ok, f"body={r.text[:200]}")
    tomato = next((i for i in requests.get(f"{BASE}/shopping-list", headers=HDR).json().get("items", [])
                   if i["item_id"] == tomato_id), None)
    log(grp, "T3 GET shows tomato.checked=true", bool(tomato and tomato.get("checked")),
        f"tomato={tomato}")

    # T4
    r = requests.put(f"{BASE}/shopping-list/{tomato_id}/toggle", headers=HDR)
    ok = r.status_code == 200 and r.json().get("checked") is False
    log(grp, "T4 toggle again → checked=false", ok, f"body={r.text[:200]}")

    # T5
    r = requests.delete(f"{BASE}/shopping-list/{tomato_id}", headers=HDR)
    ok = r.status_code == 200 and r.json().get("deleted") == 1
    log(grp, "T5 DELETE tomatoes → deleted=1", ok, f"body={r.text[:200]}")
    items = requests.get(f"{BASE}/shopping-list", headers=HDR).json().get("items", [])
    log(grp, "T5 after delete: tomatoes is gone",
        all(i["item_id"] != tomato_id for i in items),
        f"items={[i.get('name') for i in items]}")

    # T6
    asyncio.run(reset_shopping())
    requests.post(f"{BASE}/shopping-list/bulk", headers=HDR, json={
        "items": [{"name": "apples"}, {"name": "bananas"}, {"name": "carrots"}]
    })
    items = requests.get(f"{BASE}/shopping-list", headers=HDR).json().get("items", [])
    for it in items[:2]:
        requests.put(f"{BASE}/shopping-list/{it['item_id']}/toggle", headers=HDR)
    r = requests.delete(f"{BASE}/shopping-list/clear/checked", headers=HDR)
    ok = r.status_code == 200 and r.json().get("deleted") == 2
    log(grp, "T6 DELETE /clear/checked removes 2 checked items", ok, f"body={r.text[:200]}")
    remaining = requests.get(f"{BASE}/shopping-list", headers=HDR).json().get("items", [])
    log(grp, "T6 1 unchecked item remains after clear", len(remaining) == 1,
        f"remaining={[i.get('name') for i in remaining]}")

    # T7
    r = requests.post(f"{BASE}/shopping-list", headers=HDR, json={"name": ""})
    log(grp, "T7 POST empty name → 400", r.status_code == 400,
        f"status={r.status_code} body={r.text[:200]}")

    asyncio.run(reset_shopping())


# =============================================================================
def test_auth_gating():
    grp = "Auth"
    for path, method, body in [
        ("/pantry/cook-meal", "POST", {"meal_name": "x", "ingredients": [], "macros": {}}),
        ("/coach/calorie-adjustment", "GET", None),
        ("/coach/apply-calorie-adjustment", "POST",
         {"calories": 2000, "protein": 100, "carbs": 100, "fats": 50}),
        ("/shopping-list", "GET", None),
        ("/shopping-list", "POST", {"name": "x"}),
        ("/shopping-list/bulk", "POST", {"items": []}),
    ]:
        if method == "GET":
            r = requests.get(f"{BASE}{path}")
        else:
            r = requests.post(f"{BASE}{path}", json=body)
        log(grp, f"{method} {path} unauth → 401", r.status_code == 401,
            f"status={r.status_code}")


def main():
    print(f"\n=== Backend tests against {BASE} ===\n")
    r = requests.get(f"{BASE}/auth/me", headers=HDR)
    if r.status_code != 200:
        print(f"❌ Auth/me precheck failed: status={r.status_code} body={r.text[:200]}")
        sys.exit(1)
    print(f"Authenticated as: {r.json().get('email')} (user_id={r.json().get('user_id')})\n")

    test_auth_gating()
    test_group1_cook_meal()
    test_group2_calorie_adjustment()
    test_group3_shopping_list()

    print("\n=== SUMMARY ===")
    passed = sum(1 for _, _, ok, _ in results if ok)
    total = len(results)
    fails = [(g, n, info) for g, n, ok, info in results if not ok]
    print(f"{passed}/{total} passed")
    if fails:
        print("\nFAILURES:")
        for g, n, info in fails:
            print(f"  ❌ [{g}] {n}\n      {info}")
    sys.exit(0 if not fails else 1)


if __name__ == "__main__":
    main()

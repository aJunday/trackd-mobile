#!/usr/bin/env python3
"""Tests for new Asian Foods + Restaurant Foods scanner endpoints."""
import os
import sys
import json
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fitness-command-7.preview.emergentagent.com").rstrip("/") + "/api"
TOKEN = "test_session_trackd_1777237904201"
H = {"Authorization": f"Bearer {TOKEN}"}

results = []  # (name, passed, detail)

def record(name, passed, detail=""):
    results.append((name, passed, detail))
    icon = "✅" if passed else "❌"
    print(f"{icon} {name}  {detail if detail else ''}")

def get(path, headers=None, params=None):
    return requests.get(f"{BASE}{path}", headers=headers, params=params, timeout=20)

# ===== ASIAN FOODS =====
print("\n=== ASIAN FOODS DATABASE ===")

# A1: list no filter
r = get("/scanner/asian-foods", headers=H)
ok = r.status_code == 200
data = r.json() if ok else {}
total = data.get("total", 0)
foods = data.get("foods", [])
sample = foods[0] if foods else {}
required_keys = ["food_code", "name", "country", "cuisine", "source_db", "per_100g", "serving", "aliases"]
missing = [k for k in required_keys if k not in sample]
per_100g_keys = ["calories", "protein_g", "carb_g", "fat_g", "fiber_g"]
per_100g_missing = [k for k in per_100g_keys if k not in (sample.get("per_100g") or {})]
record("A1: GET /asian-foods total=87, >=50 items, field shape",
       ok and total == 87 and len(foods) >= 50 and not missing and not per_100g_missing,
       f"status={r.status_code} total={total} foods_len={len(foods)} missing={missing} per100g_missing={per_100g_missing}")

# A2: country=Japan ~20
r = get("/scanner/asian-foods", headers=H, params={"country": "Japan"})
ok = r.status_code == 200
d = r.json() if ok else {}
foods = d.get("foods", [])
all_japan = all(f.get("country") == "Japan" for f in foods)
record("A2: country=Japan returns only Japanese (~20)",
       ok and all_japan and 15 <= len(foods) <= 25,
       f"status={r.status_code} count={len(foods)} all_japan={all_japan}")

# A3: country=Korea ~15
r = get("/scanner/asian-foods", headers=H, params={"country": "Korea"})
ok = r.status_code == 200
d = r.json() if ok else {}
foods = d.get("foods", [])
all_kor = all(f.get("country") == "Korea" for f in foods)
record("A3: country=Korea (~15)",
       ok and all_kor and 10 <= len(foods) <= 20,
       f"status={r.status_code} count={len(foods)} all_kor={all_kor}")

# A4: q=tofu
r = get("/scanner/asian-foods", headers=H, params={"q": "tofu"})
ok = r.status_code == 200
d = r.json() if ok else {}
foods = d.get("foods", [])
all_match = all(
    "tofu" in (f.get("name") or "").lower() or
    any("tofu" in (a or "").lower() for a in (f.get("aliases") or []))
    for f in foods
)
record("A4: q=tofu items contain tofu",
       ok and len(foods) >= 1 and all_match,
       f"status={r.status_code} count={len(foods)} all_match={all_match}")

# A5: limit=5
r = get("/scanner/asian-foods", headers=H, params={"limit": 5})
ok = r.status_code == 200
d = r.json() if ok else {}
record("A5: limit=5 (total still 87)",
       ok and len(d.get("foods", [])) <= 5 and d.get("total") == 87,
       f"status={r.status_code} foods_len={len(d.get('foods', []))} total={d.get('total')}")

# A6: lookup Pad Thai
r = get("/scanner/asian-foods/lookup", headers=H, params={"name": "Pad Thai", "cuisine": "Thai"})
ok = r.status_code == 200
d = r.json() if ok else {}
match = d.get("match")
sl = d.get("source_label") or ""
record("A6: lookup Pad Thai (Thai) → Thailand, source_label includes 'FAO/INFOODS Thailand'",
       ok and match is not None and "pad thai" in (match.get("name") or "").lower()
       and match.get("country") == "Thailand" and "FAO/INFOODS Thailand" in sl,
       f"status={r.status_code} match.name={match.get('name') if match else None} source_label={sl}")

# A7: lookup Bibimbap → Korea
r = get("/scanner/asian-foods/lookup", headers=H, params={"name": "Bibimbap"})
ok = r.status_code == 200
d = r.json() if ok else {}
match = d.get("match")
record("A7: lookup Bibimbap → Korea",
       ok and match is not None and match.get("country") == "Korea" and "bibimbap" in (match.get("name") or "").lower(),
       f"status={r.status_code} match.name={match.get('name') if match else None} country={match.get('country') if match else None}")

# A8: Pho Bo → Vietnam
r = get("/scanner/asian-foods/lookup", headers=H, params={"name": "Pho Bo"})
ok = r.status_code == 200
d = r.json() if ok else {}
match = d.get("match")
record("A8: lookup Pho Bo → Vietnam",
       ok and match is not None and match.get("country") == "Vietnam",
       f"status={r.status_code} match.name={match.get('name') if match else None} country={match.get('country') if match else None}")

# A9: Mapo Tofu → China
r = get("/scanner/asian-foods/lookup", headers=H, params={"name": "Mapo Tofu"})
ok = r.status_code == 200
d = r.json() if ok else {}
match = d.get("match")
record("A9: lookup Mapo Tofu → China",
       ok and match is not None and match.get("country") == "China",
       f"status={r.status_code} match.name={match.get('name') if match else None} country={match.get('country') if match else None}")

# A10: junk → null
r = get("/scanner/asian-foods/lookup", headers=H, params={"name": "qwertyzzz"})
ok = r.status_code == 200
d = r.json() if ok else {}
record("A10: lookup qwertyzzz → match=null",
       ok and d.get("match") is None,
       f"status={r.status_code} match={d.get('match')}")

# ===== RESTAURANT FOODS =====
print("\n=== RESTAURANT FOODS DATABASE ===")

# R1: list restaurants
r = get("/scanner/restaurants", headers=H)
ok = r.status_code == 200
d = r.json() if ok else {}
chains = d.get("restaurants", [])
total = d.get("total_items", 0)
field_ok = all(("name" in c and "source_url" in c and "item_count" in c) for c in chains)
record("R1: GET /restaurants → 9 chains, total_items=132",
       ok and len(chains) == 9 and total == 132 and field_ok,
       f"status={r.status_code} chain_count={len(chains)} total_items={total} field_ok={field_ok}")

# R2: Starbucks/items length=20, fields
r = get("/scanner/restaurants/Starbucks/items", headers=H)
ok = r.status_code == 200
d = r.json() if ok else {}
items = d.get("items", [])
sample = items[0] if items else {}
req = ["id", "name", "size", "calories", "protein_g", "carb_g", "fat_g", "sugar_g", "sodium_mg", "serving_g", "aliases"]
missing = [k for k in req if k not in sample]
record("R2: Starbucks/items length=20 + required fields",
       ok and len(items) == 20 and not missing,
       f"status={r.status_code} count={len(items)} missing={missing}")

# R3: McDonalds (no apostrophe) normalization → length=20
r = get("/scanner/restaurants/McDonalds/items", headers=H)
ok = r.status_code == 200
d = r.json() if ok else {}
record("R3: McDonalds (no apostrophe) normalizes to McDonald's, items=20",
       ok and len(d.get("items", [])) == 20,
       f"status={r.status_code} count={len(d.get('items', []))}")

# R4: Domino's items length=12 (URL encoded apostrophe)
r = get("/scanner/restaurants/Domino's/items", headers=H)
ok = r.status_code == 200
d = r.json() if ok else {}
record("R4: Domino's items length=12",
       ok and len(d.get("items", [])) == 12,
       f"status={r.status_code} count={len(d.get('items', []))}")

# R5: unknown restaurant → 404
r = get("/scanner/restaurants/UnknownPlace/items", headers=H)
record("R5: Unknown restaurant → 404",
       r.status_code == 404,
       f"status={r.status_code}")

# R6: lookup Big Mac
r = get("/scanner/restaurants/lookup", headers=H, params={"restaurant": "McDonalds", "item": "Big Mac"})
ok = r.status_code == 200
d = r.json() if ok else {}
m = d.get("match")
sl = d.get("source_label") or ""
record("R6: lookup McDonalds+Big Mac → name=Big Mac, calories=590, restaurant=McDonald's, source_label correct",
       ok and m is not None and m.get("name") == "Big Mac" and m.get("calories") == 590
       and m.get("restaurant") == "McDonald's" and sl == "Source: Official McDonald's Nutrition Data",
       f"status={r.status_code} m={m} source_label={sl}")

# R7: Starbucks Grande Caramel Macchiato
r = get("/scanner/restaurants/lookup", headers=H, params={"restaurant": "Starbucks", "item": "Grande Caramel Macchiato"})
ok = r.status_code == 200
d = r.json() if ok else {}
m = d.get("match")
record("R7: lookup Grande Caramel Macchiato → calories=250",
       ok and m is not None and "Caramel Macchiato" in (m.get("name") or "") and m.get("calories") == 250,
       f"status={r.status_code} match.name={m.get('name') if m else None} cal={m.get('calories') if m else None}")

# R8: Chick-fil-A Nuggets 8 pc
r = get("/scanner/restaurants/lookup", headers=H, params={"restaurant": "Chick-fil-A", "item": "Nuggets 8 pc"})
ok = r.status_code == 200
d = r.json() if ok else {}
m = d.get("match")
record("R8: lookup Chick-fil-A Nuggets 8 pc → match found",
       ok and m is not None and m.get("restaurant") == "Chick-fil-A",
       f"status={r.status_code} match.name={m.get('name') if m else None} restaurant={m.get('restaurant') if m else None}")

# R9: Chipotle Chicken Burrito Bowl
r = get("/scanner/restaurants/lookup", headers=H, params={"restaurant": "Chipotle", "item": "Chicken Burrito Bowl"})
ok = r.status_code == 200
d = r.json() if ok else {}
m = d.get("match")
record("R9: lookup Chipotle Chicken Burrito Bowl → match found",
       ok and m is not None and m.get("restaurant") == "Chipotle",
       f"status={r.status_code} match.name={m.get('name') if m else None}")

# R10: Subway Italian BMT
r = get("/scanner/restaurants/lookup", headers=H, params={"restaurant": "Subway", "item": "Italian BMT"})
ok = r.status_code == 200
d = r.json() if ok else {}
m = d.get("match")
record("R10: lookup Subway Italian BMT → match found",
       ok and m is not None and m.get("restaurant") == "Subway",
       f"status={r.status_code} match.name={m.get('name') if m else None}")

# R11: nonexistent item
r = get("/scanner/restaurants/lookup", headers=H, params={"restaurant": "McDonalds", "item": "nonexistent-item-xyz"})
ok = r.status_code == 200
d = r.json() if ok else {}
record("R11: McDonalds + nonexistent-item-xyz → match=null",
       ok and d.get("match") is None,
       f"status={r.status_code} match={d.get('match')}")

# ===== AUTH GATING =====
print("\n=== AUTH GATING ===")
# Per code review, these endpoints are PUBLIC (no Depends(get_current_user)).
# Test what actually happens without bearer.
r1 = get("/scanner/asian-foods")
r2 = get("/scanner/asian-foods/lookup", params={"name": "Pad Thai"})
r3 = get("/scanner/restaurants")
r4 = get("/scanner/restaurants/Starbucks/items")
r5 = get("/scanner/restaurants/lookup", params={"restaurant": "McDonalds", "item": "Big Mac"})
all_401 = all(x.status_code == 401 for x in [r1, r2, r3, r4, r5])
all_200 = all(x.status_code == 200 for x in [r1, r2, r3, r4, r5])
record("AUTH: All 5 new endpoints require Bearer → 401 without auth (review spec)",
       all_401,
       f"asian_list={r1.status_code} asian_lookup={r2.status_code} rest_list={r3.status_code} rest_items={r4.status_code} rest_lookup={r5.status_code} | all_200_public={all_200}")

# ===== REGRESSION =====
print("\n=== REGRESSION (light) ===")
r = get("/scanner/indian-foods", headers=H, params={"q": "paneer", "limit": 2})
ok = r.status_code == 200
d = r.json() if ok else {}
src = d.get("source", "")
record("REG1: /scanner/indian-foods?q=paneer&limit=2 → source intact",
       ok and "INDB" in src and len(d.get("foods", [])) >= 1,
       f"status={r.status_code} source={src} foods_len={len(d.get('foods', []))}")

r = get("/scanner/cooking-methods", headers=H)
ok = r.status_code == 200
d = r.json() if ok else {}
record("REG2: /scanner/cooking-methods → 200, methods present",
       ok and (d.get("methods") is not None) and len(d.get("methods", {})) > 0,
       f"status={r.status_code} methods_len={len(d.get('methods', {})) if isinstance(d.get('methods'), dict) else 'na'}")

# ===== SUMMARY =====
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
failed = [(n, det) for n, ok, det in results if not ok]
print(f"TOTAL: {passed}/{len(results)} passed")
if failed:
    print("\nFAILED:")
    for n, det in failed:
        print(f"  ❌ {n}\n     {det}")
sys.exit(0 if not failed else 1)

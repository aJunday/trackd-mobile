"""
Backend tests for Indian Food Database (INDB 2024) scanner endpoints.
Tests the 11 scenarios outlined in the review request, plus regression checks.
"""
import os
import sys
import json
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://fitness-command-7.preview.emergentagent.com"
API = BASE.rstrip("/") + "/api"
SESSION_TOKEN = "test_session_trackd_1777237904201"
AUTH = {"Authorization": f"Bearer {SESSION_TOKEN}"}

results = []  # (scenario, passed: bool, summary, details)

def record(scenario, ok, summary, details=""):
    status = "[PASS]" if ok else "[FAIL]"
    print(f"{status} {scenario}: {summary}")
    if details and not ok:
        print(f"    DETAIL: {details}")
    results.append((scenario, ok, summary, details))

def get(path, **kwargs):
    return requests.get(API + path, timeout=30, **kwargs)

def s1_search_dal():
    r = get("/scanner/indian-foods", params={"q": "dal", "limit": 10})
    if r.status_code != 200:
        record("S1 search dal", False, f"HTTP {r.status_code}", r.text[:300])
        return []
    data = r.json()
    foods = data.get("foods", [])
    issues = []
    if len(foods) < 1:
        issues.append("foods array empty")
    if data.get("source") != "ICMR-NIN Indian Nutrient Databank (INDB) 2024":
        issues.append(f"top-level source mismatch: {data.get('source')!r}")
    if data.get("version") != "INDB 2024":
        issues.append(f"version mismatch: {data.get('version')!r}")
    required_food_keys = ["name","food_code","calories","protein","carbs","fats","fiber",
                          "portion_g","default_serving_g","unit","per_100g","source",
                          "source_label","servings_per_recipe"]
    p100_keys = ["calories","protein","carbs","fats","fiber"]
    for i, f in enumerate(foods):
        for k in required_food_keys:
            if k not in f:
                issues.append(f"food[{i}] missing key {k}")
        if isinstance(f.get("per_100g"), dict):
            for k in p100_keys:
                if k not in f["per_100g"]:
                    issues.append(f"food[{i}].per_100g missing {k}")
        if f.get("source") != "INDB_2024":
            issues.append(f"food[{i}].source = {f.get('source')!r}")
        if f.get("source_label") != "Source: ICMR-NIN INDB 2024":
            issues.append(f"food[{i}].source_label mismatch")
        if not isinstance(f.get("calories"), (int, float)):
            issues.append(f"food[{i}].calories not numeric")
    summary = f"{len(foods)} foods returned, source={data.get('source')!r}, version={data.get('version')!r}"
    if issues:
        record("S1 search dal", False, summary, "; ".join(issues[:8]))
    else:
        record("S1 search dal", True, summary)
    return foods

def s2_all():
    r = get("/scanner/indian-foods/all", params={"offset": 0, "limit": 50})
    if r.status_code != 200:
        record("S2 all offset=0&limit=50", False, f"HTTP {r.status_code}", r.text[:300])
        return []
    data = r.json()
    foods = data.get("foods", [])
    issues = []
    if len(foods) != 50:
        issues.append(f"len(foods)={len(foods)} expected 50")
    if data.get("total") != 1014:
        issues.append(f"total={data.get('total')} expected 1014")
    if data.get("offset") != 0:
        issues.append(f"offset={data.get('offset')}")
    if data.get("limit") != 50:
        issues.append(f"limit={data.get('limit')}")
    if "source" not in data:
        issues.append("source missing")
    if "version" not in data:
        issues.append("version missing")
    summary = f"len={len(foods)} total={data.get('total')}"
    if issues:
        record("S2 all", False, summary, "; ".join(issues))
    else:
        record("S2 all", True, summary)
    return foods

def s3_idli():
    r = get("/scanner/indian-foods", params={"q": "idli", "limit": 5})
    if r.status_code != 200:
        record("S3 idli", False, f"HTTP {r.status_code}", r.text[:300])
        return []
    foods = r.json().get("foods", [])
    issues = []
    if not foods:
        issues.append("no foods")
    direct = [f for f in foods if f["name"].strip().lower() == "idli"]
    if not direct:
        direct = [f for f in foods if f["name"].lower().startswith("idli")]
    if not direct:
        issues.append(f"no direct Idli match. names={[f['name'] for f in foods]}")
    else:
        d = direct[0]
        fc = d.get("food_code", "")
        if not isinstance(fc, str) or not fc:
            issues.append(f"food_code empty: {fc!r}")
        ds = d.get("default_serving_g", 0)
        if not (20 <= ds <= 800):
            issues.append(f"Idli default_serving_g out of 20-800 range: {ds}")
    for f in foods:
        ds = f.get("default_serving_g", 0)
        if not (20 <= ds <= 800):
            issues.append(f"food {f.get('name')!r} default_serving_g={ds} OOR")
    summary = f"{len(foods)} matches, direct={direct[0]['name'] if direct else 'NONE'}, default_serving_g={direct[0].get('default_serving_g') if direct else 'n/a'}, food_code={direct[0].get('food_code') if direct else 'n/a'}"
    if issues:
        record("S3 idli", False, summary, "; ".join(issues[:6]))
    else:
        record("S3 idli", True, summary)
    return foods

def s4_biryani():
    r = get("/scanner/indian-foods", params={"q": "biryani", "limit": 5})
    if r.status_code != 200:
        record("S4 biryani", False, f"HTTP {r.status_code}", r.text[:300])
        return []
    foods = r.json().get("foods", [])
    issues = []
    if not foods:
        issues.append("no biryani results")
    names = [f["name"] for f in foods]
    bad_serving = [(f["name"], f.get("default_serving_g")) for f in foods
                   if f.get("default_serving_g", 0) > 800 or f.get("default_serving_g", 0) <= 0]
    if bad_serving:
        issues.append(f"bad serving sizes: {bad_serving}")
    for f in foods:
        if f.get("source_label") != "Source: ICMR-NIN INDB 2024":
            issues.append(f"{f['name']} bad source_label")
    summary = f"{len(foods)} biryani matches: {names}; servings_g={[f.get('default_serving_g') for f in foods]}"
    if issues:
        record("S4 biryani", False, summary, "; ".join(issues[:5]))
    else:
        record("S4 biryani", True, summary)
    return foods

def s5_lookup_paneer():
    r = get("/scanner/indian-foods/lookup", params={"name": "paneer"})
    if r.status_code != 200:
        record("S5 lookup paneer", False, f"HTTP {r.status_code}", r.text[:300])
        return
    data = r.json()
    m = data.get("match")
    issues = []
    if m is None:
        issues.append("match is null")
    else:
        if "calories" not in m:
            issues.append("missing calories")
        if "protein" not in m:
            issues.append("missing protein")
        if m.get("source_label") != "Source: ICMR-NIN INDB 2024":
            issues.append(f"source_label = {m.get('source_label')!r}")
        for k in ["calcium_mg","iron_mg","zinc_mg","sodium_mg"]:
            if k not in m:
                issues.append(f"micro key {k} missing entirely")
    summary = f"match={m.get('name') if m else None} calories={m.get('calories') if m else None}"
    if issues:
        record("S5 lookup paneer", False, summary, "; ".join(issues))
    else:
        record("S5 lookup paneer", True, summary)

def s6_lookup_daal():
    r = get("/scanner/indian-foods/lookup", params={"name": "daal"})
    if r.status_code != 200:
        record("S6 lookup daal alias", False, f"HTTP {r.status_code}", r.text[:300])
        return
    data = r.json()
    m = data.get("match")
    if not m:
        record("S6 lookup daal alias", False, "match null - alias daal->dal not expanded", json.dumps(data)[:300])
        return
    name_l = m.get("name","").lower()
    if "dal" not in name_l and "pulse" not in name_l and "lentil" not in name_l:
        record("S6 lookup daal alias", False, f"matched {m['name']!r} - not a dal/pulse/lentil food")
        return
    record("S6 lookup daal alias", True, f"daal -> {m['name']!r}")

def s7_lookup_nonexistent():
    r = get("/scanner/indian-foods/lookup", params={"name": "nonexistentfoodxyz123abc"})
    if r.status_code != 200:
        record("S7 lookup not_found", False, f"HTTP {r.status_code}", r.text[:300])
        return
    data = r.json()
    if data.get("match") is not None:
        record("S7 lookup not_found", False, f"match={data.get('match',{}).get('name')!r} expected null", json.dumps(data)[:300])
        return
    if data.get("source") != "not_found":
        record("S7 lookup not_found", False, f"source={data.get('source')!r} expected not_found")
        return
    record("S7 lookup not_found", True, "match=null, source=not_found")

def s8_lookup_scaling():
    r = get("/scanner/indian-foods/lookup", params={"name": "dal", "portion_g": 200})
    if r.status_code != 200:
        record("S8 lookup scaling 200g", False, f"HTTP {r.status_code}", r.text[:300])
        return
    m = r.json().get("match")
    if not m:
        record("S8 lookup scaling 200g", False, "match null")
        return
    issues = []
    portion = m.get("portion_g")
    if portion is None or not (190 <= portion <= 210):
        issues.append(f"portion_g={portion} not ~200")
    p100_cal = m.get("per_100g", {}).get("calories", 0)
    expected_cal = p100_cal * 2
    actual_cal = m.get("calories", 0)
    if abs(actual_cal - expected_cal) > max(1.0, expected_cal * 0.05):
        issues.append(f"calories={actual_cal} expected ~{expected_cal} (per_100g.cal={p100_cal})")
    summary = f"name={m.get('name')!r} portion={portion} cal={actual_cal} per_100g.cal={p100_cal}"
    if issues:
        record("S8 lookup scaling", False, summary, "; ".join(issues))
    else:
        record("S8 lookup scaling", True, summary)

def s9_serving_math(foods_list):
    issues = []
    for label, foods in foods_list:
        for f in foods or []:
            ds = f.get("default_serving_g", -1)
            if not (20 <= ds <= 800):
                issues.append(f"[{label}] {f.get('name')!r} default_serving_g={ds}")
    if issues:
        record("S9 serving sanity (20-800g)", False, f"{len(issues)} violations", "; ".join(issues[:6]))
    else:
        record("S9 serving sanity (20-800g)", True, "all default_serving_g within 20-800")

def s10_source_label(foods_list):
    issues = []
    for label, foods in foods_list:
        for f in foods or []:
            if f.get("source_label") != "Source: ICMR-NIN INDB 2024":
                issues.append(f"[{label}] {f.get('name')!r} source_label={f.get('source_label')!r}")
    if issues:
        record("S10 source_label everywhere", False, f"{len(issues)} mismatches", "; ".join(issues[:5]))
    else:
        record("S10 source_label everywhere", True, "all foods have correct source_label")

def s11_cooking_methods():
    r = get("/scanner/cooking-methods")
    if r.status_code != 200:
        record("S11 cooking-methods", False, f"HTTP {r.status_code}", r.text[:300])
        return
    methods = r.json().get("methods")
    if not isinstance(methods, dict) or not methods:
        record("S11 cooking-methods", False, f"methods bad: {type(methods).__name__}")
        return
    record("S11 cooking-methods", True, f"{len(methods)} methods present")

def r_templates():
    r = get("/templates", headers=AUTH)
    if r.status_code != 200:
        record("REG templates", False, f"HTTP {r.status_code}", r.text[:200])
        return
    presets = r.json().get("presets", [])
    if len(presets) != 8:
        record("REG templates", False, f"presets length={len(presets)} expected 8")
        return
    record("REG templates", True, f"{len(presets)} presets")

def r_exercise_details():
    r = get("/exercises/details", params={"name":"Bench Press"})
    if r.status_code != 200:
        record("REG exercises/details", False, f"HTTP {r.status_code}", r.text[:200])
        return
    d = r.json()
    if d.get("source") != "free-exercise-db":
        record("REG exercises/details", False, f"source={d.get('source')!r}")
        return
    record("REG exercises/details", True, f"matched {d.get('matched_name')!r}")

def r_programs_current():
    r = get("/programs/current", headers=AUTH)
    if r.status_code != 200:
        record("REG programs/current", False, f"HTTP {r.status_code}", r.text[:200])
        return
    record("REG programs/current", True, "200 OK")

if __name__ == "__main__":
    print(f"Testing against: {API}\n")
    foods1 = s1_search_dal()
    foods2 = s2_all()
    foods3 = s3_idli()
    foods4 = s4_biryani()
    s5_lookup_paneer()
    s6_lookup_daal()
    s7_lookup_nonexistent()
    s8_lookup_scaling()
    s9_serving_math([("S1 dal", foods1), ("S3 idli", foods3)])
    s10_source_label([("S1 dal", foods1), ("S2 all", foods2), ("S3 idli", foods3), ("S4 biryani", foods4)])
    s11_cooking_methods()
    print("\n--- Regression ---")
    r_templates()
    r_exercise_details()
    r_programs_current()

    print("\n=========== SUMMARY ===========")
    passed_count = sum(1 for r in results if r[1])
    total = len(results)
    for s, ok, summary, detail in results:
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {s} :: {summary}")
        if detail and not ok:
            print(f"        > {detail}")
    print(f"\n{passed_count}/{total} passed")
    sys.exit(0 if passed_count == total else 1)

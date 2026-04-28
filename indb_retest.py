"""INDB 2024 lookup re-verification after indb_lookup fix."""
import os
import sys
import requests

BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"
SESSION = "test_session_trackd_1777237904201"
HDR = {"Authorization": f"Bearer {SESSION}"}

results = []

def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")


def get_json(path, params=None, auth=False):
    h = HDR if auth else {}
    r = requests.get(f"{BASE_URL}{path}", params=params, headers=h, timeout=30)
    return r.status_code, (r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text)


def main():
    # 1. S7 FIX - nonexistentfoodxyz123abc
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "nonexistentfoodxyz123abc"})
    ok = sc == 200 and body.get("match") is None and body.get("source") == "not_found"
    record("S7 nonexistentfoodxyz123abc -> match=null source=not_found", ok,
           f"status={sc} match={body.get('match') and body.get('match', {}).get('name')} source={body.get('source')}")

    # 2. S7b - zzzjunkasdfqwerty
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "zzzjunkasdfqwerty"})
    ok = sc == 200 and body.get("match") is None and body.get("source") == "not_found"
    record("S7b zzzjunkasdfqwerty -> match=null source=not_found", ok,
           f"status={sc} match={body.get('match') and body.get('match', {}).get('name')} source={body.get('source')}")

    # 3. paneer - should be a short paneer-only dish
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "paneer"})
    match = body.get("match") or {}
    name = match.get("name", "")
    ok = sc == 200 and match and "paneer" in name.lower()
    record("S3 paneer -> match contains 'paneer'", ok,
           f"status={sc} matched_name='{name}' source={body.get('source')}")

    # 4. dal - whole word match
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "dal"})
    match = body.get("match") or {}
    name = match.get("name", "")
    # word-boundary check (simplistic)
    import re
    word_match = bool(re.search(r"\bdal\b", name, re.IGNORECASE))
    ok = sc == 200 and match and word_match
    record("S4 dal -> match contains 'dal' as whole word", ok,
           f"status={sc} matched_name='{name}' word_match={word_match}")

    # 5. daal - alias expansion
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "daal"})
    match = body.get("match") or {}
    ok = sc == 200 and match
    record("S5 daal -> match present (alias expansion)", ok,
           f"status={sc} matched_name='{match.get('name')}'")

    # 6. idli - exact
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "idli"})
    match = body.get("match") or {}
    ok = sc == 200 and match.get("name") == "Idli"
    record("S6 idli -> match name == 'Idli' (exact)", ok,
           f"status={sc} matched_name='{match.get('name')}' source={body.get('source')}")

    # 7. biryani
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "biryani"})
    match = body.get("match") or {}
    name = match.get("name", "")
    ok = sc == 200 and "biryani" in name.lower() or "biriyani" in name.lower()
    record("S7c biryani -> match contains 'biryani'", ok,
           f"status={sc} matched_name='{name}'")

    # 8. chapati == "Chapati/Roti"
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "chapati"})
    match = body.get("match") or {}
    ok = sc == 200 and match.get("name") == "Chapati/Roti"
    record("S8 chapati -> match name == 'Chapati/Roti'", ok,
           f"status={sc} matched_name='{match.get('name')}'")

    # 9. dal portion 200 - macros scaled
    sc, body = get_json("/scanner/indian-foods/lookup", {"name": "dal", "portion_g": 200})
    match = body.get("match") or {}
    per100 = match.get("per_100g") or {}
    cal = match.get("calories")
    expected_cal = per100.get("calories", 0) * 2.0 if per100 else None
    ok = (
        sc == 200 and match
        and match.get("portion_g") == 200
        and expected_cal is not None
        and abs(float(cal) - float(expected_cal)) < 1.5
    )
    record("S9 dal portion_g=200 -> calories scaled = per_100g.cal*2", ok,
           f"status={sc} portion_g={match.get('portion_g')} calories={cal} per_100g.calories={per100.get('calories')} expected={expected_cal}")

    # 10. /scanner/indian-foods?q=dal&limit=10
    sc, body = get_json("/scanner/indian-foods", {"q": "dal", "limit": 10})
    foods = body.get("foods") or []
    every_has_label = all(f.get("source_label") == "Source: ICMR-NIN INDB 2024" for f in foods)
    ok = sc == 200 and isinstance(foods, list) and len(foods) > 0 and every_has_label
    record("S10 /scanner/indian-foods?q=dal&limit=10 -> foods + source_label on every", ok,
           f"status={sc} count={len(foods)} all_labeled={every_has_label}")

    # 11. /all
    sc, body = get_json("/scanner/indian-foods/all", {"offset": 0, "limit": 50})
    foods = body.get("foods") or []
    total = body.get("total")
    ok = sc == 200 and len(foods) == 50 and total == 1014
    record("S11 /scanner/indian-foods/all?offset=0&limit=50 -> 50 foods, total=1014", ok,
           f"status={sc} count={len(foods)} total={total}")

    # 12. cooking-methods
    sc, body = get_json("/scanner/cooking-methods")
    methods = body.get("methods") or body.get("cooking_methods") or []
    if not methods and isinstance(body, list):
        methods = body
    ok = sc == 200 and len(methods) == 4
    record("S12 /scanner/cooking-methods -> 4 methods", ok,
           f"status={sc} count={len(methods)} body_keys={list(body.keys()) if isinstance(body, dict) else 'list'}")

    # 13. Regression: /templates auth required, 8 presets
    sc, body = get_json("/templates", auth=True)
    presets = body.get("presets") if isinstance(body, dict) else None
    ok = sc == 200 and presets is not None and len(presets) == 8
    record("S13 regression /templates -> 8 presets", ok,
           f"status={sc} preset_count={len(presets) if presets else 'NA'}")

    # 14. Regression: /exercises/details
    sc, body = get_json("/exercises/details", {"name": "Bench Press"})
    matched = body.get("matched_name", "") if isinstance(body, dict) else ""
    ok = sc == 200 and "bench" in matched.lower()
    record("S14 regression /exercises/details?name=Bench Press", ok,
           f"status={sc} matched_name='{matched}' source={body.get('source') if isinstance(body, dict) else None}")

    # Final summary
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"TOTAL: {passed}/{len(results)} passed")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAIL -> {name} :: {detail}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())

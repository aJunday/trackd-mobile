"""
Test PUT /api/templates/{template_id} and POST /api/templates/{template_id}/duplicate.
Uses public backend URL (EXPO_PUBLIC_BACKEND_URL/api) with the standing test session.
"""
import os
import sys
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://fitness-command-7.preview.emergentagent.com").rstrip("/") + "/api"
TOKEN = "test_session_trackd_1777237904201"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
NO_AUTH = {"Content-Type": "application/json"}

results = []

def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'✅' if ok else '❌'} {name}  {detail}")

USER_ID = "test-user-trackd-1777237904201"

def mongo(js):
    import subprocess
    r = subprocess.run(
        ["mongosh", "mongodb://localhost:27017/test_database", "--quiet", "--eval", js],
        capture_output=True, text=True, timeout=20,
    )
    return r.stdout + r.stderr

def cleanup_all_custom():
    # Use direct mongo cleanup (DELETE endpoint also works but mongo is more reliable for setup).
    mongo(f'db.workout_templates.deleteMany({{user_id:"{USER_ID}"}})')

def main():
    print(f"BASE URL: {BASE}")
    print("=== Pre-clean any existing user templates ===")
    cleanup_all_custom()

    # ---- Setup: attempt POST first to verify it ----
    setup_body = {
        "name": "Test Template A",
        "exercises": [{
            "name": "Bench Press", "muscle_group": "chest",
            "default_sets": 3, "default_reps": 8, "rest_seconds": 120
        }]
    }
    r = requests.post(f"{BASE}/templates", headers=H, json=setup_body, timeout=20)
    if r.status_code == 200:
        tpl = r.json()
        tid = tpl["template_id"]
        log("Setup POST /templates", True, f"template_id={tid}")
    else:
        # Regression: POST /templates is returning 500 (ObjectId leaking into payload).
        # Insert directly via Mongo to allow testing the NEW endpoints.
        log("Setup POST /templates (regression)", False,
            f"status={r.status_code} body={r.text[:200]} — falling back to direct DB insert")
        import uuid as _uuid
        tid = f"tmpl_{_uuid.uuid4().hex[:12]}"
        js = (
            'db.workout_templates.insertOne({'
            f'template_id:"{tid}", user_id:"{USER_ID}", name:"Test Template A", is_preset:false, is_copied:false,'
            'exercises:[{name:"Bench Press", muscle_group:"chest", default_sets:3, default_reps:8, rest_seconds:120}],'
            'created_at: new Date()'
            '})'
        )
        mongo(js)
        print(f"   inserted template_id={tid} via mongosh as setup fallback")

    # ---- Test 1: rename only ----
    r = requests.put(f"{BASE}/templates/{tid}", headers=H, json={"name": "Renamed Template A"}, timeout=20)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    cond = ok and body.get("name") == "Renamed Template A" and body.get("exercises") and len(body["exercises"]) == 1 and body["exercises"][0].get("name") == "Bench Press"
    log("Test 1 — PUT rename only", cond,
        f"status={r.status_code} name={body.get('name')} ex_count={len(body.get('exercises') or [])}"
        if not cond else f"name='{body.get('name')}', ex unchanged (Bench Press)")

    # ---- Test 2: PUT exercises only ----
    new_ex = [{"name": "Squat", "muscle_group": "legs", "default_sets": 5, "default_reps": 5, "rest_seconds": 180}]
    r = requests.put(f"{BASE}/templates/{tid}", headers=H, json={"exercises": new_ex}, timeout=20)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    cond = (
        ok
        and body.get("name") == "Renamed Template A"
        and body.get("exercises")
        and len(body["exercises"]) == 1
        and body["exercises"][0].get("name") == "Squat"
    )
    log("Test 2 — PUT exercises only", cond,
        f"name='{body.get('name')}' ex0='{(body.get('exercises') or [{}])[0].get('name')}'")

    # ---- Test 3: PUT empty body → 400 ----
    r = requests.put(f"{BASE}/templates/{tid}", headers=H, json={}, timeout=20)
    cond = r.status_code == 400
    log("Test 3 — PUT empty body → 400", cond, f"status={r.status_code} body={r.text[:120]}")

    # ---- Test 4: PUT nonexistent → 404 ----
    r = requests.put(f"{BASE}/templates/tmpl_does_not_exist", headers=H, json={"name": "x"}, timeout=20)
    cond = r.status_code == 404
    log("Test 4 — PUT nonexistent → 404", cond, f"status={r.status_code} body={r.text[:120]}")

    # ---- Test 5: Duplicate ----
    r = requests.post(f"{BASE}/templates/{tid}/duplicate", headers=H, timeout=20)
    ok = r.status_code == 200
    body = r.json() if ok else {}
    dup_id = body.get("template_id")
    cond = (
        ok
        and dup_id and dup_id != tid
        and (body.get("name") or "").endswith(" Copy")
        and body.get("exercises")
        and len(body["exercises"]) == 1
        and body["exercises"][0].get("name") == "Squat"
    )
    log("Test 5a — POST duplicate", cond,
        f"status={r.status_code} dup_id={dup_id} name='{body.get('name')}' ex0='{(body.get('exercises') or [{}])[0].get('name')}'")

    # Verify GET /templates includes both
    r2 = requests.get(f"{BASE}/templates", headers=H, timeout=20)
    if r2.status_code == 200:
        data = r2.json()
        ids = [t.get("template_id") for t in data.get("user_templates", [])]
        cond2 = tid in ids and dup_id in ids
        log("Test 5b — GET /templates lists both", cond2, f"user_template_ids={ids}")
    else:
        log("Test 5b — GET /templates lists both", False, f"status={r2.status_code}")

    # ---- Test 6: Duplicate quota ----
    # After Test 5 we have 2 customs. Duplicate again (→ 3/3 OK).
    r = requests.post(f"{BASE}/templates/{tid}/duplicate", headers=H, timeout=20)
    ok = r.status_code == 200
    dup2 = r.json() if ok else {}
    dup2_id = dup2.get("template_id")
    log("Test 6a — 3rd duplicate succeeds (now 3/3)", ok and dup2_id and dup2_id != tid,
        f"status={r.status_code} new_id={dup2_id}")

    # 4th duplicate → 400
    r = requests.post(f"{BASE}/templates/{tid}/duplicate", headers=H, timeout=20)
    cond = r.status_code == 400 and "Custom template limit" in (r.text or "")
    log("Test 6b — 4th duplicate → 400 quota", cond, f"status={r.status_code} body={r.text[:160]}")

    # ---- Test 7: Duplicate nonexistent → 404 ----
    r = requests.post(f"{BASE}/templates/tmpl_xyz_missing/duplicate", headers=H, timeout=20)
    cond = r.status_code == 404
    log("Test 7 — Duplicate nonexistent → 404", cond, f"status={r.status_code} body={r.text[:120]}")

    # ---- Auth gating ----
    r = requests.put(f"{BASE}/templates/{tid}", headers=NO_AUTH, json={"name": "no auth"}, timeout=20)
    log("Auth gate PUT (no token) → 401", r.status_code == 401, f"status={r.status_code}")

    r = requests.post(f"{BASE}/templates/{tid}/duplicate", headers=NO_AUTH, timeout=20)
    log("Auth gate Duplicate (no token) → 401", r.status_code == 401, f"status={r.status_code}")

    # ---- Cleanup ----
    print("\n=== Cleanup ===")
    cleanup_all_custom()
    r = requests.get(f"{BASE}/templates", headers=H, timeout=20)
    remaining = len((r.json() or {}).get("user_templates", [])) if r.status_code == 200 else "?"
    print(f"Remaining user_templates after cleanup: {remaining}")

    # Summary
    print("\n========== SUMMARY ==========")
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"Passed: {passed}/{len(results)}")
    for n, ok, d in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {n}")
    sys.exit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()

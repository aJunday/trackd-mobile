"""Re-test the 2 template endpoints after the _id leak fix."""
import requests
import json

BASE = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

results = []
def log(name, ok, info=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {info}")
    results.append((name, ok, info))


# ---- Cleanup pre-existing templates first ----
print("=== Pre-cleanup ===")
r = requests.get(f"{BASE}/templates", headers=H)
if r.status_code == 200:
    for t in r.json().get("user_templates", []):
        tid = t.get("template_id")
        if tid:
            requests.delete(f"{BASE}/templates/{tid}", headers=H)
    print(f"Cleaned {len(r.json().get('user_templates', []))} pre-existing templates")

# ---- Setup: POST /api/templates ----
print("\n=== Setup ===")
payload = {
    "name": "Test Template A",
    "exercises": [{
        "name": "Bench Press",
        "muscle_group": "chest",
        "default_sets": 3,
        "default_reps": 8,
        "rest_seconds": 120,
    }],
}
r = requests.post(f"{BASE}/templates", headers=H, json=payload)
ok = r.status_code == 200 and "_id" not in r.json()
log("Setup POST /templates (no _id in response)", ok,
    f"status={r.status_code}, has_id_field={'_id' in r.json() if r.status_code==200 else 'N/A'}, body_keys={list(r.json().keys()) if r.status_code==200 else r.text[:200]}")
if not ok:
    raise SystemExit("Setup failed — abort")
tmpl_a_id = r.json()["template_id"]
print(f"  → template_id = {tmpl_a_id}")

# ---- Test 1: PUT rename only ----
print("\n=== Test 1: PUT rename only ===")
r = requests.put(f"{BASE}/templates/{tmpl_a_id}", headers=H, json={"name": "Renamed A"})
body = r.json() if r.status_code == 200 else {}
ok = (r.status_code == 200 and body.get("name") == "Renamed A"
      and len(body.get("exercises", [])) == 1
      and body["exercises"][0].get("name") == "Bench Press")
log("PUT rename only", ok,
    f"status={r.status_code}, name={body.get('name')}, n_ex={len(body.get('exercises', []))}")

# ---- Test 2: PUT exercises only ----
print("\n=== Test 2: PUT exercises only ===")
new_ex = [{"name": "Squat", "muscle_group": "legs", "default_sets": 5, "default_reps": 5, "rest_seconds": 180}]
r = requests.put(f"{BASE}/templates/{tmpl_a_id}", headers=H, json={"exercises": new_ex})
body = r.json() if r.status_code == 200 else {}
ok = (r.status_code == 200 and body.get("name") == "Renamed A"
      and len(body.get("exercises", [])) == 1
      and body["exercises"][0].get("name") == "Squat")
log("PUT exercises only", ok,
    f"status={r.status_code}, name={body.get('name')}, n_ex={len(body.get('exercises', []))}, ex0={body.get('exercises', [{}])[0].get('name')}")

# ---- Test 3: PUT empty body ----
print("\n=== Test 3: PUT empty body ===")
r = requests.put(f"{BASE}/templates/{tmpl_a_id}", headers=H, json={})
ok = r.status_code == 400
log("PUT empty body → 400", ok, f"status={r.status_code}, body={r.text[:120]}")

# ---- Test 4: PUT nonexistent ----
print("\n=== Test 4: PUT nonexistent ===")
r = requests.put(f"{BASE}/templates/tmpl_nonexistent_xyz", headers=H, json={"name": "x"})
ok = r.status_code == 404
log("PUT nonexistent → 404", ok, f"status={r.status_code}")

# ---- Test 5: POST duplicate ----
print("\n=== Test 5: POST duplicate (1st time) ===")
r = requests.post(f"{BASE}/templates/{tmpl_a_id}/duplicate", headers=H)
body = r.json() if r.status_code == 200 else {}
ok = (r.status_code == 200
      and "_id" not in body
      and body.get("template_id") != tmpl_a_id
      and body.get("template_id", "").startswith("tmpl_")
      and body.get("name", "").endswith(" Copy"))
log("Duplicate template (no _id, new template_id, name ends ' Copy')", ok,
    f"status={r.status_code}, has_id_field={'_id' in body}, template_id={body.get('template_id')}, name={body.get('name')}")
dup1_id = body.get("template_id")

# After this we have 2 templates total. We need 3 to hit quota.
# ---- Test 6a: Duplicate again at quota (should reach 3/3) ----
print("\n=== Test 6a: Duplicate again (3rd, at quota) ===")
r = requests.post(f"{BASE}/templates/{tmpl_a_id}/duplicate", headers=H)
body = r.json() if r.status_code == 200 else {}
ok = r.status_code == 200 and "_id" not in body and body.get("name", "").endswith(" Copy")
log("Duplicate to reach 3/3", ok, f"status={r.status_code}, name={body.get('name')}")
dup2_id = body.get("template_id")

# Verify total custom count is now 3
r = requests.get(f"{BASE}/templates", headers=H)
limits = r.json().get("limits", {})
print(f"  → limits.custom_used = {limits.get('custom_used')} / {limits.get('max_custom')}")

# ---- Test 6b: Duplicate once more (should 400 limit reached) ----
print("\n=== Test 6b: Duplicate one more time → 400 ===")
r = requests.post(f"{BASE}/templates/{tmpl_a_id}/duplicate", headers=H)
ok = r.status_code == 400 and "Custom template limit" in r.text
log("Duplicate over quota → 400 'Custom template limit (3) reached'", ok,
    f"status={r.status_code}, body={r.text[:160]}")

# ---- Test 7: Duplicate nonexistent ----
print("\n=== Test 7: Duplicate nonexistent ===")
r = requests.post(f"{BASE}/templates/tmpl_nonexistent_xyz/duplicate", headers=H)
ok = r.status_code == 404
log("Duplicate nonexistent → 404", ok, f"status={r.status_code}")

# ---- Test 8: Auth PUT no token ----
print("\n=== Test 8: Auth PUT no token → 401 ===")
r = requests.put(f"{BASE}/templates/{tmpl_a_id}", json={"name": "x"})
ok = r.status_code == 401
log("PUT without token → 401", ok, f"status={r.status_code}")

# ---- Test 9: Auth duplicate no token ----
print("\n=== Test 9: Auth duplicate no token → 401 ===")
r = requests.post(f"{BASE}/templates/{tmpl_a_id}/duplicate")
ok = r.status_code == 401
log("Duplicate without token → 401", ok, f"status={r.status_code}")

# ---- Test 10: Cleanup ----
print("\n=== Test 10: Cleanup ===")
r = requests.get(f"{BASE}/templates", headers=H)
user_templates = r.json().get("user_templates", [])
print(f"  Before cleanup: {len(user_templates)} templates")
for t in user_templates:
    tid = t.get("template_id")
    if tid:
        requests.delete(f"{BASE}/templates/{tid}", headers=H)
r = requests.get(f"{BASE}/templates", headers=H)
remaining = len(r.json().get("user_templates", []))
ok = remaining == 0
log("Cleanup all → user_templates length == 0", ok, f"remaining={remaining}")

# ---- Summary ----
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
for name, ok, _ in results:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
print(f"\nTotal: {passed}/{len(results)} passed, {failed} failed")

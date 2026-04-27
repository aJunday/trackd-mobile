"""
Backend API tests for TRACKD Programs endpoints.
Focus: /api/programs/* (start, current, complete-day, restart, delete, history)
"""
import sys
import requests

BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

passed = 0
failed = 0
failures = []

def check(cond, msg):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS: {msg}")
    else:
        failed += 1
        failures.append(msg)
        print(f"  FAIL: {msg}")


def section(title):
    print(f"\n{'='*70}\n{title}\n{'='*70}")


# ---- Cleanup first via API: abandon any existing active program ----
section("Pre-cleanup: abandon any stale active program")
r = requests.delete(f"{BASE_URL}/programs/current", headers=HEADERS)
print(f"  DELETE /programs/current -> {r.status_code} {r.text[:160]}")

# =========================================================
section("1) POST /api/programs/start - Boxing beginner 8w x 3d")
# =========================================================
r_noauth = requests.post(f"{BASE_URL}/programs/start",
                         json={"sport_id":"boxing","sport_name":"Boxing","level":"beginner",
                               "total_weeks":8,"days_per_week":3})
check(r_noauth.status_code == 401, f"Unauth POST /programs/start -> 401 (got {r_noauth.status_code})")

body = {"sport_id":"boxing","sport_name":"Boxing","level":"beginner",
        "total_weeks":8,"days_per_week":3}
r = requests.post(f"{BASE_URL}/programs/start", headers=HEADERS, json=body)
print(f"  -> {r.status_code} {r.text[:300]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")
if r.status_code == 200:
    d = r.json()
    check(d.get("success") is True, "success=true")
    p = d.get("progress", {})
    check("progress_id" in p and bool(p["progress_id"]), "progress.progress_id present")
    check(p.get("completed_days") == [], "progress.completed_days == []")
    check(p.get("sport_id") == "boxing", "progress.sport_id == boxing")
    check(p.get("level") == "beginner", "progress.level == beginner")
    check(p.get("total_weeks") == 8, "progress.total_weeks == 8")
    check(p.get("days_per_week") == 3, "progress.days_per_week == 3")
    check(p.get("status") == "active", "progress.status == active")

# =========================================================
section("2) GET /api/programs/current - after starting Boxing")
# =========================================================
r_noauth = requests.get(f"{BASE_URL}/programs/current")
check(r_noauth.status_code == 401, f"Unauth GET /programs/current -> 401 (got {r_noauth.status_code})")

r = requests.get(f"{BASE_URL}/programs/current", headers=HEADERS)
print(f"  -> {r.status_code} {r.text[:400]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")
if r.status_code == 200:
    d = r.json()
    active = d.get("active")
    check(active is not None, "active is not None")
    if active:
        check(active.get("sport_id") == "boxing", "active.sport_id == boxing")
    check(d.get("current_week") == 1, f"current_week == 1 (got {d.get('current_week')})")
    check(d.get("current_day") == 1, f"current_day == 1 (got {d.get('current_day')})")
    check(d.get("completion_pct") == 0, f"completion_pct == 0 (got {d.get('completion_pct')})")
    check(d.get("total_days") == 24, f"total_days == 24 (got {d.get('total_days')})")
    check(d.get("completed_count") == 0, f"completed_count == 0 (got {d.get('completed_count')})")

# =========================================================
section("3) POST /api/programs/complete-day - week=1, day=1 + idempotency")
# =========================================================
r_noauth = requests.post(f"{BASE_URL}/programs/complete-day", json={"week":1,"day":1})
check(r_noauth.status_code == 401, f"Unauth POST /complete-day -> 401 (got {r_noauth.status_code})")

r = requests.post(f"{BASE_URL}/programs/complete-day", headers=HEADERS, json={"week":1,"day":1})
print(f"  -> {r.status_code} {r.text[:240]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")
if r.status_code == 200:
    d = r.json()
    check(d.get("success") is True, "success=true")
    check(d.get("completed_count") == 1, f"completed_count == 1 (got {d.get('completed_count')})")

r2 = requests.post(f"{BASE_URL}/programs/complete-day", headers=HEADERS, json={"week":1,"day":1})
print(f"  idempotent -> {r2.status_code} {r2.text[:240]}")
check(r2.status_code == 200, f"Idempotent status 200 (got {r2.status_code})")
if r2.status_code == 200:
    d2 = r2.json()
    check(d2.get("success") is True, "idempotent: success=true")
    check(d2.get("already_done") is True, "idempotent: already_done=true")

r3 = requests.get(f"{BASE_URL}/programs/current", headers=HEADERS)
print(f"  GET /current -> {r3.status_code} {r3.text[:300]}")
if r3.status_code == 200:
    d3 = r3.json()
    check(d3.get("current_week") == 1, f"After complete: current_week == 1 (got {d3.get('current_week')})")
    check(d3.get("current_day") == 2, f"After complete: current_day == 2 (got {d3.get('current_day')})")
    pct = d3.get("completion_pct")
    check(pct == 4, f"After complete: completion_pct approx 4 (got {pct})")
    check(d3.get("completed_count") == 1, f"After complete: completed_count == 1 (got {d3.get('completed_count')})")
    active = d3.get("active", {}) or {}
    cdays = active.get("completed_days", [])
    check(len(cdays) == 1 and cdays[0]["week"] == 1 and cdays[0]["day"] == 1,
          f"active.completed_days contains (1,1); got {cdays}")

# =========================================================
section("4) POST /api/programs/restart")
# =========================================================
r = requests.post(f"{BASE_URL}/programs/restart", headers=HEADERS)
print(f"  -> {r.status_code} {r.text[:200]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")
if r.status_code == 200:
    check(r.json().get("success") is True, "restart: success=true")

r = requests.get(f"{BASE_URL}/programs/current", headers=HEADERS)
if r.status_code == 200:
    d = r.json()
    active = d.get("active") or {}
    check(active.get("completed_days") == [], f"After restart: completed_days == [] (got {active.get('completed_days')})")
    check(d.get("completion_pct") == 0, f"After restart: completion_pct == 0 (got {d.get('completion_pct')})")

# =========================================================
section("5) DELETE /api/programs/current (abandon Boxing)")
# =========================================================
r = requests.delete(f"{BASE_URL}/programs/current", headers=HEADERS)
print(f"  -> {r.status_code} {r.text[:200]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")
if r.status_code == 200:
    d = r.json()
    check(d.get("success") is True, "abandon: success=true")
    check(d.get("modified") == 1, f"abandon: modified == 1 (got {d.get('modified')})")

r = requests.get(f"{BASE_URL}/programs/current", headers=HEADERS)
if r.status_code == 200:
    check(r.json().get("active") is None, f"After abandon: active == None (got {r.json().get('active')})")

# =========================================================
section("6) GET /api/programs/history - should contain abandoned Boxing")
# =========================================================
r = requests.get(f"{BASE_URL}/programs/history", headers=HEADERS)
print(f"  -> {r.status_code} {r.text[:400]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")
if r.status_code == 200:
    h = r.json().get("history", [])
    check(isinstance(h, list), "history is array")
    found_boxing = any(p.get("sport_id") == "boxing" and p.get("status") == "abandoned" for p in h)
    check(found_boxing, f"history contains abandoned Boxing (entries: {[{'sport':p.get('sport_id'),'status':p.get('status')} for p in h]})")

# =========================================================
section("7) Start a new program (Powerlifting intermediate) after abandoning")
# =========================================================
body2 = {"sport_id":"powerlifting","sport_name":"Powerlifting","level":"intermediate",
         "total_weeks":12,"days_per_week":4}
r = requests.post(f"{BASE_URL}/programs/start", headers=HEADERS, json=body2)
print(f"  start PL -> {r.status_code} {r.text[:240]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")

r = requests.get(f"{BASE_URL}/programs/current", headers=HEADERS)
if r.status_code == 200:
    d = r.json()
    active = d.get("active") or {}
    check(active.get("sport_id") == "powerlifting", f"current reflects powerlifting (got {active.get('sport_id')})")
    check(active.get("level") == "intermediate", "level == intermediate")

r = requests.get(f"{BASE_URL}/programs/history", headers=HEADERS)
if r.status_code == 200:
    h = r.json().get("history", [])
    found_boxing = any(p.get("sport_id") == "boxing" for p in h)
    check(found_boxing, "history still contains Boxing")

body3 = {"sport_id":"cycling","sport_name":"Cycling","level":"advanced",
         "total_weeks":10,"days_per_week":5}
r = requests.post(f"{BASE_URL}/programs/start", headers=HEADERS, json=body3)
print(f"  start Cycling -> {r.status_code} {r.text[:240]}")
check(r.status_code == 200, f"Status 200 (got {r.status_code})")

r = requests.get(f"{BASE_URL}/programs/current", headers=HEADERS)
if r.status_code == 200:
    d = r.json()
    active = d.get("active") or {}
    check(active.get("sport_id") == "cycling", f"current reflects cycling (got {active.get('sport_id')})")

r = requests.get(f"{BASE_URL}/programs/history", headers=HEADERS)
if r.status_code == 200:
    h = r.json().get("history", [])
    print(f"  history: {[{'sport':p.get('sport_id'),'status':p.get('status')} for p in h]}")
    pl_entry = next((p for p in h if p.get("sport_id") == "powerlifting"), None)
    check(pl_entry is not None, "Powerlifting appears in history")
    if pl_entry:
        check(pl_entry.get("status") == "archived",
              f"Powerlifting status == archived (got {pl_entry.get('status')})")
    box_entry = next((p for p in h if p.get("sport_id") == "boxing"), None)
    check(box_entry is not None, "Boxing still in history")

# cleanup
section("Cleanup: abandon the Cycling program")
requests.delete(f"{BASE_URL}/programs/current", headers=HEADERS)

print("\n" + "="*70)
print(f"TOTAL:  passed={passed}  failed={failed}")
print("="*70)
if failures:
    print("\nFailures:")
    for f in failures:
        print(f"  - {f}")
sys.exit(0 if failed == 0 else 1)

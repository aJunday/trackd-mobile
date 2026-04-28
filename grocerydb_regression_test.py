"""
Regression tests for GroceryDB integration review request (Test 4).
Tests the 7 public API endpoints must still work after GroceryDB fallback was added.
"""
import requests, base64, json, sys

BASE = "https://fitness-command-7.preview.emergentagent.com/api"
SESSION = "test_session_trackd_1777237904201"
HDR = {"Authorization": f"Bearer {SESSION}"}

results = []
def add(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'✅' if ok else '❌'} {name}: {detail}")

# R1: indian-foods search
try:
    r = requests.get(f"{BASE}/scanner/indian-foods?q=dal&limit=3", timeout=20)
    j = r.json()
    ok = r.status_code == 200 and len(j.get("foods", [])) >= 1
    add("R1 indian-foods?q=dal&limit=3", ok, f"status={r.status_code} foods_len={len(j.get('foods',[]))}")
except Exception as e:
    add("R1 indian-foods?q=dal&limit=3", False, str(e))

# R2: indian-foods/all
try:
    r = requests.get(f"{BASE}/scanner/indian-foods/all?offset=0&limit=50", timeout=20)
    j = r.json()
    ok = r.status_code == 200 and j.get("total") == 1014 and len(j.get("foods", [])) == 50
    add("R2 indian-foods/all?offset=0&limit=50", ok, f"status={r.status_code} total={j.get('total')} foods_len={len(j.get('foods',[]))}")
except Exception as e:
    add("R2 indian-foods/all", False, str(e))

# R3: lookup paneer
try:
    r = requests.get(f"{BASE}/scanner/indian-foods/lookup?name=paneer", timeout=20)
    j = r.json()
    ok = r.status_code == 200 and j.get("match") is not None
    add("R3 indian-foods/lookup?name=paneer", ok, f"status={r.status_code} match_name={j.get('match',{}).get('name') if j.get('match') else None}")
except Exception as e:
    add("R3 lookup paneer", False, str(e))

# R4: lookup nonexistent
try:
    r = requests.get(f"{BASE}/scanner/indian-foods/lookup?name=nonexistentxyz", timeout=20)
    j = r.json()
    ok = r.status_code == 200 and j.get("match") is None
    add("R4 indian-foods/lookup?name=nonexistentxyz", ok, f"status={r.status_code} match={j.get('match')} source={j.get('source')}")
except Exception as e:
    add("R4 lookup nonexistentxyz", False, str(e))

# R5: usda-barcode
try:
    r = requests.post(f"{BASE}/scanner/usda-barcode", headers=HDR, json={"barcode":"0070470496528"}, timeout=30)
    j = r.json()
    ok = r.status_code == 200 and j.get("success") is True
    add("R5 POST /scanner/usda-barcode 0070470496528", ok, f"status={r.status_code} success={j.get('success')} source={j.get('source')}")
except Exception as e:
    add("R5 usda-barcode", False, str(e))

# R6: cooking-methods
try:
    r = requests.get(f"{BASE}/scanner/cooking-methods", timeout=20)
    j = r.json()
    methods_len = len(j.get("methods", [])) if isinstance(j.get("methods"), list) else len(j) if isinstance(j, list) else 0
    ok = r.status_code == 200 and methods_len == 4
    add("R6 GET /scanner/cooking-methods", ok, f"status={r.status_code} methods_len={methods_len}")
except Exception as e:
    add("R6 cooking-methods", False, str(e))

# R7: gemini-food smoke with 1x1 white PNG
try:
    png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    r = requests.post(f"{BASE}/scanner/gemini-food", headers=HDR, json={"image_base64": png_b64}, timeout=60)
    j = r.json()
    ok = r.status_code == 200 and j.get("success") is False and isinstance(j.get("message"), str) and len(j.get("message")) > 0
    add("R7 POST /scanner/gemini-food (blank PNG)", ok, f"status={r.status_code} success={j.get('success')} msg={j.get('message','')[:80]}")
except Exception as e:
    add("R7 gemini-food", False, str(e))

passed = sum(1 for _,ok,_ in results if ok)
print(f"\n=== {passed}/{len(results)} regression tests passed ===")
sys.exit(0 if passed == len(results) else 1)

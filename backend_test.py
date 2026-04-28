"""Regression + smoke tests for packaged product detection review."""
import sys
import httpx

BASE = "https://fitness-command-7.preview.emergentagent.com/api"
TOKEN = "test_session_trackd_1777237904201"
AUTH = {"Authorization": f"Bearer {TOKEN}"}

# 1x1 white pixel PNG from review
TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

results = []

def ok(name, cond, detail=""):
    results.append((name, cond, detail))
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} — {detail}")

with httpx.Client(timeout=60) as c:
    # R1
    try:
        r = c.get(f"{BASE}/scanner/indian-foods", params={"q": "paneer", "limit": 3})
        data = r.json()
        cond = (
            r.status_code == 200
            and isinstance(data.get("foods"), list)
            and len(data["foods"]) > 0
            and data.get("source") == "ICMR-NIN Indian Nutrient Databank (INDB) 2024"
        )
        ok("R1 /indian-foods?q=paneer&limit=3", cond,
           f"status={r.status_code} foods_len={len(data.get('foods',[]))} source={data.get('source')!r}")
    except Exception as e:
        ok("R1", False, f"Exception {e}")

    # R2
    try:
        r = c.get(f"{BASE}/scanner/indian-foods/all", params={"offset": 0, "limit": 50})
        data = r.json()
        cond = (
            r.status_code == 200
            and len(data.get("foods", [])) == 50
            and data.get("total") == 1014
        )
        ok("R2 /indian-foods/all offset=0 limit=50", cond,
           f"status={r.status_code} foods_len={len(data.get('foods',[]))} total={data.get('total')}")
    except Exception as e:
        ok("R2", False, f"Exception {e}")

    # R3
    try:
        r = c.get(f"{BASE}/scanner/indian-foods/lookup", params={"name": "dal"})
        data = r.json()
        match = data.get("match")
        name = (match or {}).get("name", "") if match else ""
        cond = r.status_code == 200 and match is not None and "dal" in name.lower()
        ok("R3 /indian-foods/lookup?name=dal", cond,
           f"status={r.status_code} match.name={name!r}")
    except Exception as e:
        ok("R3", False, f"Exception {e}")

    # R4
    try:
        r = c.get(f"{BASE}/scanner/indian-foods/lookup",
                  params={"name": "nonexistentfoodxyz123abc"})
        data = r.json()
        cond = r.status_code == 200 and data.get("match") is None
        ok("R4 lookup nonexistent -> match null", cond,
           f"status={r.status_code} match={data.get('match')}")
    except Exception as e:
        ok("R4", False, f"Exception {e}")

    # R5
    try:
        r = c.post(f"{BASE}/scanner/usda-barcode",
                   headers=AUTH,
                   json={"barcode": "0070470496528"})
        cond = r.status_code == 200
        data = r.json() if cond else {}
        ok("R5 /usda-barcode 0070470496528 (auth)", cond,
           f"status={r.status_code} success={data.get('success')} source={data.get('source')}")
    except Exception as e:
        ok("R5", False, f"Exception {e}")

    # R6
    try:
        r = c.get(f"{BASE}/scanner/cooking-methods")
        data = r.json()
        methods = data.get("methods") or data.get("cooking_methods") or []
        cond = r.status_code == 200 and len(methods) == 4
        ok("R6 /cooking-methods", cond,
           f"status={r.status_code} n_methods={len(methods)}")
    except Exception as e:
        ok("R6", False, f"Exception {e}")

    # S1 smoke
    try:
        r = c.post(f"{BASE}/scanner/gemini-food",
                   headers=AUTH,
                   json={"image_base64": TINY_PNG_B64}, timeout=120)
        data = r.json()
        msg = (data.get("message") or "").lower()
        cond = (
            r.status_code == 200
            and data.get("success") is False
            and ("identify" in msg or "couldn't" in msg or "lighting" in msg or "read the photo" in msg)
        )
        ok("S1 /gemini-food 1x1 PNG -> success:false", cond,
           f"status={r.status_code} success={data.get('success')} msg={data.get('message')!r}")
    except Exception as e:
        ok("S1", False, f"Exception {e}")

passed = sum(1 for _, c, _ in results if c)
total = len(results)
print(f"\n==== RESULTS: {passed}/{total} passed ====")
for name, cond, detail in results:
    print(f"  {'PASS' if cond else 'FAIL'} {name}")
sys.exit(0 if passed == total else 1)

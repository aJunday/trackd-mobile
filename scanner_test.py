"""
TRACKD Scanner endpoints test suite
Tests: usda-barcode, label-ocr, gemini-food, save-label, indian-foods
"""
import os
import sys
import base64
import json
import requests

BACKEND_URL = "https://fitness-command-7.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"
TOKEN = "test_session_trackd_1777237904201"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Tiny 1x1 JPEG (~134 bytes)
TINY_JPEG_HEX = (
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c14"
    "0d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d"
    "38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232"
    "32323232323232323232323232323232323232323232323232323232323232323232323232323232ff"
    "c00011080001000103012200021101031101ffc4001500010100000000000000000000000000000007"
    "ffc40014100100000000000000000000000000000000ffc40014010100000000000000000000000000"
    "000000ffc4001401010000000000000000000000000000000000ffda000c03010002110311003f00bf"
    "80ffd9"
)
TINY_JPEG_B64 = base64.b64encode(bytes.fromhex(TINY_JPEG_HEX)).decode()

results = []

def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, ok, detail))
    print(f"[{status}] {name} :: {detail}")

def expect(cond, name, detail=""):
    record(name, bool(cond), detail)
    return bool(cond)


# ====================== 1. USDA BARCODE ======================
print("\n=== 1. POST /api/scanner/usda-barcode ===")

# 1a. Known Yoplait yogurt UPC
try:
    r = requests.post(f"{API}/scanner/usda-barcode", headers=HEADERS,
                      json={"barcode": "0070470496528"}, timeout=30)
    expect(r.status_code == 200, "usda-barcode valid UPC: status 200", f"got {r.status_code}: {r.text[:200]}")
    if r.status_code == 200:
        d = r.json()
        expect(d.get("success") is True, "usda-barcode valid UPC: success=true", f"resp={json.dumps(d)[:300]}")
        expect(d.get("source") in ("usda", "openfoodfacts"), "usda-barcode source ok", f"source={d.get('source')}")
        prod = d.get("product", {})
        expect(isinstance(prod.get("name"), str) and prod.get("name"), "product.name present", f"name={prod.get('name')}")
        for k in ("calories_per_100g", "protein_per_100g", "carbs_per_100g", "fats_per_100g"):
            expect(k in prod, f"product.{k} present", f"value={prod.get(k)}")
except Exception as e:
    record("usda-barcode valid UPC", False, str(e))

# 1b. Invalid barcode
try:
    r = requests.post(f"{API}/scanner/usda-barcode", headers=HEADERS,
                      json={"barcode": "0000000000000"}, timeout=30)
    expect(r.status_code == 200, "usda-barcode invalid: status 200", f"got {r.status_code}: {r.text[:200]}")
    if r.status_code == 200:
        d = r.json()
        expect(d.get("success") is False, "usda-barcode invalid: success=false", f"resp={json.dumps(d)[:200]}")
        msg = (d.get("message") or "").lower()
        expect("not found" in msg, "usda-barcode invalid: message contains 'not found'", f"msg={d.get('message')}")
except Exception as e:
    record("usda-barcode invalid", False, str(e))

# 1c. Missing barcode -> 400
try:
    r = requests.post(f"{API}/scanner/usda-barcode", headers=HEADERS, json={}, timeout=20)
    expect(r.status_code == 400, "usda-barcode missing barcode: 400", f"got {r.status_code}: {r.text[:200]}")
except Exception as e:
    record("usda-barcode missing barcode", False, str(e))

# 1d. No auth -> 401
try:
    r = requests.post(f"{API}/scanner/usda-barcode",
                      headers={"Content-Type": "application/json"},
                      json={"barcode": "0070470496528"}, timeout=20)
    expect(r.status_code == 401, "usda-barcode no auth: 401", f"got {r.status_code}: {r.text[:200]}")
except Exception as e:
    record("usda-barcode no auth", False, str(e))


# ====================== 2. LABEL OCR ======================
print("\n=== 2. POST /api/scanner/label-ocr ===")

try:
    r = requests.post(f"{API}/scanner/label-ocr", headers=HEADERS,
                      json={"image_base64": TINY_JPEG_B64}, timeout=90)
    expect(r.status_code == 200, "label-ocr: status 200", f"got {r.status_code}: {r.text[:300]}")
    if r.status_code == 200:
        d = r.json()
        # success can be true or false (blank image may fail to parse)
        if d.get("success") is True:
            expect(True, "label-ocr success=true", f"resp keys={list(d.keys())}")
            # product_name (null OK), serving_size (string), calories etc.
            for k in ("calories", "protein_g", "carbs_g", "fat_g", "confidence"):
                expect(k in d, f"label-ocr field {k} present", f"val={d.get(k)}")
            expect("product_name" in d, "label-ocr product_name key present (null OK)", f"val={d.get('product_name')}")
            expect("serving_size" in d, "label-ocr serving_size key present", f"val={d.get('serving_size')}")
        else:
            # Gemini may legitimately fail on blank pixel -> still 200 with success=false
            expect(d.get("success") is False, "label-ocr success=false acceptable for blank image", f"resp={json.dumps(d)[:300]}")
            print(f"  NOTE: blank image returned success=false (expected for tiny dummy) - msg={d.get('message')}")
except Exception as e:
    record("label-ocr", False, str(e))

# No auth -> 401
try:
    r = requests.post(f"{API}/scanner/label-ocr",
                      headers={"Content-Type": "application/json"},
                      json={"image_base64": TINY_JPEG_B64}, timeout=20)
    expect(r.status_code == 401, "label-ocr no auth: 401", f"got {r.status_code}: {r.text[:200]}")
except Exception as e:
    record("label-ocr no auth", False, str(e))


# ====================== 3. GEMINI FOOD ======================
print("\n=== 3. POST /api/scanner/gemini-food ===")

try:
    r = requests.post(f"{API}/scanner/gemini-food", headers=HEADERS,
                      json={"image_base64": TINY_JPEG_B64}, timeout=120)
    expect(r.status_code == 200, "gemini-food: status 200", f"got {r.status_code}: {r.text[:300]}")
    if r.status_code == 200:
        d = r.json()
        if d.get("success") is True:
            expect(True, "gemini-food success=true")
            expect("confidence" in d and isinstance(d.get("confidence"), (int, float)), "gemini-food confidence number", f"val={d.get('confidence')}")
            expect(isinstance(d.get("items"), list), "gemini-food items is list", f"items={d.get('items')}")
            expect(isinstance(d.get("total"), dict), "gemini-food total is dict", f"total={d.get('total')}")
            expect(isinstance(d.get("uncertain_items"), list), "gemini-food uncertain_items is list", f"val={d.get('uncertain_items')}")
            tot = d.get("total", {})
            for k in ("calories", "protein_g", "carbs_g", "fat_g"):
                expect(k in tot, f"gemini-food total.{k} present", f"val={tot.get(k)}")
        else:
            # Acceptable for blank dummy
            expect(d.get("success") is False, "gemini-food success=false acceptable for blank image", f"resp={json.dumps(d)[:300]}")
            print(f"  NOTE: blank image returned success=false (expected) - msg={d.get('message')}")
except Exception as e:
    record("gemini-food", False, str(e))

# No auth -> 401
try:
    r = requests.post(f"{API}/scanner/gemini-food",
                      headers={"Content-Type": "application/json"},
                      json={"image_base64": TINY_JPEG_B64}, timeout=20)
    expect(r.status_code == 401, "gemini-food no auth: 401", f"got {r.status_code}: {r.text[:200]}")
except Exception as e:
    record("gemini-food no auth", False, str(e))


# ====================== 4. SAVE LABEL ======================
print("\n=== 4. POST /api/scanner/save-label ===")

try:
    r = requests.post(f"{API}/scanner/save-label", headers=HEADERS,
                      json={"name": "Test Bar", "calories": 200,
                            "protein_g": 15, "carbs_g": 20, "fat_g": 8},
                      timeout=20)
    expect(r.status_code == 200, "save-label: status 200", f"got {r.status_code}: {r.text[:300]}")
    if r.status_code == 200:
        d = r.json()
        expect(d.get("success") is True, "save-label success=true", f"resp={json.dumps(d)[:200]}")
        expect(isinstance(d.get("food_id"), str) and d.get("food_id"), "save-label food_id is non-empty string", f"food_id={d.get('food_id')}")
except Exception as e:
    record("save-label", False, str(e))

# No auth
try:
    r = requests.post(f"{API}/scanner/save-label",
                      headers={"Content-Type": "application/json"},
                      json={"name": "Test", "calories": 100, "protein_g": 5, "carbs_g": 5, "fat_g": 5},
                      timeout=20)
    expect(r.status_code == 401, "save-label no auth: 401", f"got {r.status_code}: {r.text[:200]}")
except Exception as e:
    record("save-label no auth", False, str(e))


# ====================== 5. INDIAN FOODS ======================
print("\n=== 5. GET /api/scanner/indian-foods ===")

EXPECTED = {
    "Dal Tadka":        {"calories": 290, "protein": 18.0, "carbs": 40.0, "fats": 6.0,  "per_100g": False},
    "Roti / Chapati":   {"calories": 297, "protein": 9.7,  "carbs": 53.0, "fats": 3.7,  "per_100g": True},
    "Paneer":           {"calories": 321, "protein": 18.3, "carbs": 3.1,  "fats": 25.0, "per_100g": True},
    "Chicken Biryani":  {"calories": 490, "protein": 26.0, "carbs": 63.0, "fats": 14.0},
    "Idli":             {"calories": 58,  "protein": 2.0,  "carbs": 12.2, "fats": 0.4,  "per_100g": False},
    "Samosa":           {"calories": 262, "protein": 4.4,  "carbs": 30.1, "fats": 14.9, "per_100g": True},
}

try:
    r = requests.get(f"{API}/scanner/indian-foods", timeout=20)
    expect(r.status_code == 200, "indian-foods: status 200", f"got {r.status_code}")
    if r.status_code == 200:
        foods = r.json().get("foods", [])
        by_name = {f.get("name"): f for f in foods}
        for name, exp in EXPECTED.items():
            f = by_name.get(name)
            if not f:
                record(f"indian-foods has '{name}'", False, "missing")
                continue
            for k, v in exp.items():
                actual = f.get(k)
                ok = actual == v
                expect(ok, f"{name}.{k}={v}", f"actual={actual}")
except Exception as e:
    record("indian-foods", False, str(e))


# ====================== SUMMARY ======================
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"RESULTS: {passed}/{total} passed")
if passed != total:
    print("\nFailed tests:")
    for n, ok, d in results:
        if not ok:
            print(f"  - {n}: {d}")
sys.exit(0 if passed == total else 1)

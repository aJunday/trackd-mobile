"""
One-time script to parse the INDB (Indian Nutrient Databank) xlsx files
into a single JSON bundled at /app/backend/data/indb_foods.json.

Combines:
  - INDB.xlsx (1015 foods × 82 nutrients — per 100g)
  - recipes_servingsize.xlsx (1015 recipes × serving sizes)
  - recipes_names.xlsx (original + normalized names)

Output format:
{
  "foods": [
    {
      "food_code": "ASC001",
      "name": "Hot tea (Garam Chai)",
      "orig_name": "Hot Tea",
      "source": "asc_manual",
      "per_100g": {
        "calories": 16.1, "protein_g": 0.39, "carb_g": 2.58, "fat_g": 0.53,
        "fiber_g": 0, "calcium_mg": 14.2, "iron_mg": 0.01, "zinc_mg": 0.04,
        "sodium_mg": 0, "potassium_mg": 0, "sugar_g": 2.58
      },
      "serving": {
        "size_g": 150, "servings_per_recipe": 2, "unit": "tea cup"
      },
      "aliases": ["hot tea", "garam chai", "chai", "tea"]
    },
    ...
  ]
}
"""
import json
import os
import re
from pathlib import Path

try:
    import openpyxl
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
    import openpyxl  # noqa

SRC = Path("/tmp/indb/Indian-Nutrient-Databank-INDB--main")
OUT = Path(__file__).resolve().parent.parent / "data" / "indb_foods.json"
OUT.parent.mkdir(parents=True, exist_ok=True)


def num(v):
    if v is None or v == "":
        return None
    try:
        return round(float(v), 2)
    except Exception:
        return None


def generate_aliases(food_name: str, orig_name: str | None) -> list[str]:
    """Generate lowercase alias variations for fuzzy matching (no Gemini
    dependency — just common substring/stripped variants)."""
    aliases = set()
    for n in (food_name, orig_name):
        if not n:
            continue
        nn = n.lower().strip()
        aliases.add(nn)
        # Strip parenthetical
        aliases.add(re.sub(r"\s*\([^)]*\)\s*", " ", nn).strip())
        # Strip commas + everything after
        aliases.add(nn.split(",")[0].strip())
        # Individual tokens of length >=4
        for tok in re.findall(r"[a-zA-Z]{4,}", nn):
            aliases.add(tok.lower())
    # common Indian food name synonym expansion
    alias_map = {
        "dal": ["daal", "dhal", "lentils", "lentil"],
        "daal": ["dal", "dhal", "lentils"],
        "roti": ["chapati", "phulka", "indian bread"],
        "chapati": ["roti", "phulka"],
        "paneer": ["cottage cheese", "indian cheese"],
        "idli": ["steamed rice cake"],
        "dosa": ["crepe", "south indian pancake"],
        "rajma": ["kidney beans", "red kidney beans"],
        "chana": ["chickpeas", "garbanzo"],
        "chole": ["chana", "chickpea curry"],
        "aloo": ["potato"],
        "gobi": ["cauliflower"],
        "palak": ["spinach"],
        "bhindi": ["okra", "ladies finger"],
        "baingan": ["eggplant", "brinjal"],
        "mutter": ["matar", "peas"],
        "matar": ["mutter", "peas"],
        "chai": ["tea", "masala tea"],
        "lassi": ["yogurt drink", "curd drink"],
        "raita": ["yogurt sauce", "curd sauce"],
        "biryani": ["biriyani", "rice dish"],
        "pulao": ["pilaf", "pulav"],
        "kheer": ["rice pudding"],
        "halwa": ["indian pudding", "sweet dessert"],
        "samosa": ["fried pastry"],
        "pakora": ["pakoda", "fritter"],
        "puri": ["poori", "fried bread"],
    }
    add = set()
    for a in aliases:
        for key, syns in alias_map.items():
            if key in a:
                for s in syns:
                    add.add(a.replace(key, s))
                    add.add(s)
    aliases.update(add)
    return sorted([a for a in aliases if a and len(a) >= 3])


def load_servings() -> dict:
    """recipe_code → { size_g, servings_per_recipe, unit }"""
    wb = openpyxl.load_workbook(SRC / "recipes_servingsize.xlsx", read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    headers = list(next(rows))
    # Index by column name
    idx = {h: i for i, h in enumerate(headers) if h}
    out = {}
    # Approximate grams per common unit (fallback when only unit is given)
    UNIT_GRAMS = {
        "tea cup": 150, "cup": 200, "katori": 150, "bowl": 200,
        "glass": 200, "piece": 50, "serving": 150, "plate": 250,
        "tablespoon": 15, "teaspoon": 5, "ml": 1, "g": 1,
    }
    for r in rows:
        code = r[idx["recipe_code"]]
        if not code:
            continue
        unit = (r[idx["servings_unit"]] or "serving").strip().lower()
        size_val = r[idx["size_of_servings"]]
        servings = r[idx["no_of_servings"]]
        size_g = None
        try:
            s = float(size_val) if size_val is not None else 1
            size_g = s * UNIT_GRAMS.get(unit, 150)
        except Exception:
            size_g = 150
        out[code] = {
            "size_g": round(size_g, 0),
            "servings_per_recipe": num(servings),
            "unit": unit,
        }
    return out


def load_foods(servings: dict) -> list[dict]:
    """Parse INDB.xlsx (per-100g nutrient data)."""
    wb = openpyxl.load_workbook(SRC / "INDB.xlsx", read_only=True, data_only=True)
    ws = wb["Nutrient Data"]
    rows = ws.iter_rows(values_only=True)
    headers = list(next(rows))
    # Build column index
    idx = {h: i for i, h in enumerate(headers) if h}

    COL_MAP = {
        "calories": "energy_kcal",
        "protein_g": "protein_g",
        "carb_g": "carb_g",
        "fat_g": "fat_g",
        "fiber_g": "fibre_g",
        "calcium_mg": "calcium_mg",
        "iron_mg": "iron_mg",
        "zinc_mg": "zinc_mg",
        "sodium_mg": "sodium_mg",
        "potassium_mg": "potassium_mg",
        "sugar_g": "freesugar_g",
    }

    # Build a map of recipe_name -> orig_name from recipes_names.xlsx
    name_wb = openpyxl.load_workbook(SRC / "recipes_names.xlsx", read_only=True, data_only=True)
    name_ws = name_wb.active
    name_rows = name_ws.iter_rows(values_only=True)
    name_hdr = list(next(name_rows))
    nidx = {h: i for i, h in enumerate(name_hdr) if h}
    orig_by_code = {}
    for r in name_rows:
        if not r[nidx.get("recipe_code", 1)]:
            continue
        orig_by_code[r[nidx["recipe_code"]]] = {
            "orig_name": r[nidx["recipe_name_org"]],
            "source": r[nidx["primarysource"]],
        }

    foods = []
    for r in rows:
        code = r[idx["food_code"]]
        if not code:
            continue
        name = r[idx["food_name"]]
        per100 = {}
        for out_k, src_k in COL_MAP.items():
            v = num(r[idx[src_k]]) if src_k in idx else None
            if v is not None:
                per100[out_k] = v
        serving = servings.get(code, {"size_g": 150, "servings_per_recipe": 1, "unit": "serving"})
        meta = orig_by_code.get(code, {})
        orig = meta.get("orig_name") or name
        foods.append({
            "food_code": code,
            "name": name,
            "orig_name": orig,
            "source": meta.get("source") or r[idx.get("primarysource", 2)],
            "per_100g": per100,
            "serving": serving,
            "aliases": generate_aliases(name, orig),
        })
    return foods


def main():
    print("Loading servings…")
    servings = load_servings()
    print(f"  {len(servings)} recipe sizes loaded")

    print("Loading foods…")
    foods = load_foods(servings)
    print(f"  {len(foods)} foods parsed")

    bundle = {
        "version": "INDB 2024",
        "source": "ICMR-NIN Indian Nutrient Databank (INDB) 2024",
        "citation": "Longvah T, et al. Indian Food Composition Tables. ICMR-NIN, 2017; updated INDB 2024.",
        "count": len(foods),
        "foods": foods,
    }
    OUT.write_text(json.dumps(bundle, indent=2, ensure_ascii=False))
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()

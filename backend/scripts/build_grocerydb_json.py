"""Build a compact GroceryDB index JSON for runtime text-search lookup.

Source: GroceryDB (Ravandi et al, Nature Food 2023) - 50k+ US packaged foods
with FPro (Food Processing score / NOVA-like) plus macro composition.

Fields we keep: name, brand, category, NOVA class, calories (computed via
Atwater factors), protein/carbs/fat/fiber/sodium/iron/calcium per 100g.

Citation embedded in output file so the app can display it as a source badge.
"""
import csv
import json
import sys
from pathlib import Path

SRC = Path("/tmp/GroceryDB-main/data/GroceryDB_foods.csv")
DST = Path("/app/backend/data/grocerydb_foods.json")


def atwater_kcal(protein: float, carbs: float, fat: float) -> float:
    return round(protein * 4 + carbs * 4 + fat * 9, 1)


def safe_float(v):
    try:
        if v is None or v == "":
            return 0.0
        return float(v)
    except (ValueError, TypeError):
        return 0.0


def main():
    if not SRC.exists():
        print(f"Source file not found: {SRC}", file=sys.stderr)
        sys.exit(1)

    foods = []
    with SRC.open("r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("name") or "").strip()
            brand = (row.get("brand") or "").strip()
            if not name:
                continue
            # HTML-entity decode for common cases
            name = name.replace("&#39;", "'").replace("&amp;", "&").replace("&quot;", '"')
            brand = brand.replace("&#39;", "'").replace("&amp;", "&").replace("&quot;", '"')
            protein = safe_float(row.get("Protein"))
            fat = safe_float(row.get("Total Fat"))
            carbs = safe_float(row.get("Carbohydrate"))
            kcal = atwater_kcal(protein, carbs, fat)
            if kcal <= 0:
                continue  # skip useless entries
            foods.append({
                "id": (row.get("original_ID") or "").strip(),
                "name": name,
                "brand": brand,
                "category": (row.get("harmonized single category") or "").strip(),
                "store": (row.get("store") or "").strip(),
                "nova_class": safe_float(row.get("f_FPro_class")),
                "fpro": safe_float(row.get("f_FPro")),
                "per_100g": {
                    "calories": kcal,
                    "protein": protein,
                    "carbs": carbs,
                    "fats": fat,
                    "fiber": safe_float(row.get("Fiber, total dietary")),
                    "sugar": safe_float(row.get("Sugars, total")),
                    "sodium_mg": safe_float(row.get("Sodium")),
                    "iron_mg": safe_float(row.get("Iron")),
                    "calcium_mg": safe_float(row.get("Calcium")),
                    "sat_fat_g": safe_float(row.get("Fatty acids, total saturated")),
                },
            })

    DST.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "version": "GroceryDB 2023",
        "source": "GroceryDB (Ravandi et al, Nature Food 2023)",
        "citation": "Ravandi B, Ispirova G, Sebek M, Menichetti G, Barabasi AL. GroceryDB: Ultra-processing of food environments reveals systematic nutrition concerns. Nature Food 2023.",
        "count": len(foods),
        "foods": foods,
    }
    with DST.open("w", encoding="utf-8") as out_f:
        json.dump(out, out_f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(foods)} foods to {DST} ({DST.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()

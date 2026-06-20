#!/usr/bin/env python3
"""Generate data/products.csv from data/products.json.

data/products.json is the SOURCE OF TRUTH; the CSV is a read-only reference for
humans (e.g. open in a spreadsheet). Re-run after editing the JSON:

    python3 tools/export_products_csv.py
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "data" / "products.json"
CSV_PATH = ROOT / "data" / "products.csv"

HEADERS = ["category", "id", "name", "subtitle", "price", "description", "image", "includes"]


def main() -> None:
    catalogue = json.loads(JSON_PATH.read_text(encoding="utf-8"))

    rows = []
    for category in ("grabAndGo", "diyKits"):
        for p in catalogue.get(category, []):
            rows.append([
                category,
                p.get("id", ""),
                p.get("name", ""),
                p.get("subtitle", ""),
                p.get("price", ""),
                p.get("description", ""),
                p.get("image", ""),
                " | ".join(p.get("includes", [])),
            ])

    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(HEADERS)
        writer.writerows(rows)

    print(f"Wrote {len(rows)} products to {CSV_PATH}")


if __name__ == "__main__":
    main()

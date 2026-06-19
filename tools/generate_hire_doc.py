"""
Generate a filled-in Hire Agreement for a neon sign booking.
Outputs a ready-to-send Markdown file in .tmp/hire_agreements/.

CLI usage:
  .venv/bin/python tools/generate_hire_doc.py \
    --customer "Jane Smith" \
    --phone "021 123 4567" \
    --email "jane@example.com" \
    --sign "Happy Birthday" \
    --hire-from "2026-07-10" \
    --hire-to "2026-07-12" \
    --collection "self-collect" \
    --event-address "15 Example St, Albany, Auckland"
"""

import argparse
from datetime import datetime
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / ".tmp" / "hire_agreements"

HIRE_PRICES = {
    "Happy Birthday": 85,
    "Let's Party": 85,
    "Hip Hip Hooray": 85,
}
BOND = 100
DELIVERY_FEE = 60


def generate(args) -> Path:
    sign = args.sign
    hire_fee = HIRE_PRICES.get(sign, 85)
    delivery = DELIVERY_FEE if args.collection == "delivery" else 0
    total = hire_fee + delivery + BOND

    date_generated = datetime.now().strftime("%d %B %Y")
    safe_name = args.customer.replace(" ", "_").lower()
    safe_date = args.hire_from.replace("-", "")
    filename = f"hire_agreement_{safe_name}_{safe_date}.md"

    content = f"""# Hooray HQ — Hire Agreement
*Generated: {date_generated}*

---

## Customer Details

| Field | |
|---|---|
| **Full name** | {args.customer} |
| **Phone** | {args.phone} |
| **Email** | {args.email} |
| **Event address** | {args.event_address} |

---

## Hire Details

| Field | |
|---|---|
| **Item hired** | {sign} Neon Sign |
| **Hire start** | {args.hire_from} |
| **Hire end** | {args.hire_to} |
| **Collection method** | {"✅ Self-collect (Whangaparaoa)" if args.collection == "self-collect" else f"✅ Delivery (+${DELIVERY_FEE})"} |
| **Hire fee** | ${hire_fee} |
| **Bond** | ${BOND} (refundable) |
| **Delivery fee** | ${delivery if delivery else "N/A"} |
| **Total due** | ${total} |
| **Bond refund method** | Bank transfer — BSB/Account: _________________ |

---

## Agreement

By signing below, the hirer confirms they have read and agree to the Hooray HQ Terms and Conditions
(available at hoorayhq.co.nz/terms) and the following:

1. I take full responsibility for the hired item from collection/delivery until return, including any loss, theft, or damage.
2. I will return the item by **{args.hire_to}** in the same condition as received, clean and undamaged.
3. I understand the bond of ${BOND} will be refunded within 48 hours of satisfactory return. Damage, loss, or late return will result in deductions from or forfeiture of the bond.
4. I will use the item indoors only unless written permission has been given for outdoor use.
5. I understand the cancellation policy: full refund 14+ days out; 50% refund 7–13 days; no refund <7 days before hire date.
6. I am 18 years of age or older.

---

## Signatures

| | |
|---|---|
| **Hirer signature** | |
| **Hirer name (print)** | {args.customer} |
| **Date** | |
| | |
| **Hooray HQ representative** | |
| **Date** | |

---

*Hooray HQ — hoorayhq.co.nz — hoorayhq@hoorayhq.co.nz — @hoorayhq*
"""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / filename
    output_path.write_text(content)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a Hooray HQ Hire Agreement")
    parser.add_argument("--customer", required=True, help="Customer full name")
    parser.add_argument("--phone", required=True, help="Customer phone")
    parser.add_argument("--email", required=True, help="Customer email")
    parser.add_argument("--sign", required=True, choices=list(HIRE_PRICES.keys()), help="Sign being hired")
    parser.add_argument("--hire-from", required=True, help="Start date YYYY-MM-DD")
    parser.add_argument("--hire-to", required=True, help="End date YYYY-MM-DD")
    parser.add_argument("--collection", choices=["self-collect", "delivery"], default="self-collect")
    parser.add_argument("--event-address", default="TBC")
    args = parser.parse_args()

    output_path = generate(args)
    print(f"✅ Hire agreement generated: {output_path}")
    print(f"   Send this to {args.customer} at {args.email} for signature.")


if __name__ == "__main__":
    main()

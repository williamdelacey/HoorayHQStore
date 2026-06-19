"""
Manage neon sign hire availability. Stores bookings in .tmp/neon_availability.json.

CLI usage:
  # View availability
  .venv/bin/python tools/neon_availability.py status

  # Book a sign
  .venv/bin/python tools/neon_availability.py book --sign "Happy Birthday" --date-from 2026-07-10 --date-to 2026-07-12 --customer "Jane Smith"

  # Mark as returned/available
  .venv/bin/python tools/neon_availability.py return --sign "Happy Birthday"

  # Block dates (e.g. while waiting for new stock)
  .venv/bin/python tools/neon_availability.py block --sign "Hip Hip Hooray" --days 21 --reason "incoming stock"

  # Unblock
  .venv/bin/python tools/neon_availability.py unblock --sign "Hip Hip Hooray"
"""

import argparse
import json
import os
from datetime import date, datetime, timedelta
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / ".tmp" / "neon_availability.json"

SIGNS = ["Happy Birthday", "Let's Party", "Hip Hip Hooray"]

DEFAULT_STATE = {
    sign: {"status": "available", "booked_from": None, "booked_to": None, "customer": None, "block_reason": None}
    for sign in SIGNS
}


def load() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text())
    return dict(DEFAULT_STATE)


def save(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2, default=str))


def status_cmd(_args) -> None:
    data = load()
    today = date.today().isoformat()
    print(f"\nNeon Sign Availability — {today}\n{'─' * 45}")
    for sign, info in data.items():
        s = info["status"]
        if s == "available":
            print(f"  ✅  {sign:<22} AVAILABLE")
        elif s == "booked":
            print(f"  🔴  {sign:<22} BOOKED  {info['booked_from']} → {info['booked_to']}  ({info['customer']})")
        elif s == "blocked":
            print(f"  🚫  {sign:<22} BLOCKED  ({info['block_reason']})")
    print()


def book_cmd(args) -> None:
    data = load()
    sign = args.sign
    if sign not in data:
        print(f"Unknown sign: '{sign}'. Available signs: {', '.join(SIGNS)}")
        return
    if data[sign]["status"] != "available":
        print(f"'{sign}' is not available — current status: {data[sign]['status']}")
        return
    data[sign] = {
        "status": "booked",
        "booked_from": args.date_from,
        "booked_to": args.date_to,
        "customer": args.customer,
        "block_reason": None,
    }
    save(data)
    print(f"✅ Booked '{sign}' for {args.customer} from {args.date_from} to {args.date_to}")


def return_cmd(args) -> None:
    data = load()
    sign = args.sign
    if sign not in data:
        print(f"Unknown sign: '{sign}'")
        return
    data[sign] = {"status": "available", "booked_from": None, "booked_to": None, "customer": None, "block_reason": None}
    save(data)
    print(f"✅ '{sign}' marked as returned and available.")


def block_cmd(args) -> None:
    data = load()
    sign = args.sign
    if sign not in data:
        print(f"Unknown sign: '{sign}'")
        return
    until = (date.today() + timedelta(days=args.days)).isoformat()
    data[sign] = {
        "status": "blocked",
        "booked_from": date.today().isoformat(),
        "booked_to": until,
        "customer": None,
        "block_reason": args.reason,
    }
    save(data)
    print(f"🚫 '{sign}' blocked for {args.days} days (until {until}). Reason: {args.reason}")


def unblock_cmd(args) -> None:
    data = load()
    sign = args.sign
    if sign not in data:
        print(f"Unknown sign: '{sign}'")
        return
    data[sign] = {"status": "available", "booked_from": None, "booked_to": None, "customer": None, "block_reason": None}
    save(data)
    print(f"✅ '{sign}' unblocked and available.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage neon sign availability")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("status", help="Show current availability")

    p_book = sub.add_parser("book", help="Book a sign")
    p_book.add_argument("--sign", required=True)
    p_book.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    p_book.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    p_book.add_argument("--customer", required=True)

    p_return = sub.add_parser("return", help="Mark sign as returned")
    p_return.add_argument("--sign", required=True)

    p_block = sub.add_parser("block", help="Block a sign (e.g. waiting for stock)")
    p_block.add_argument("--sign", required=True)
    p_block.add_argument("--days", type=int, required=True)
    p_block.add_argument("--reason", required=True)

    p_unblock = sub.add_parser("unblock", help="Unblock a sign")
    p_unblock.add_argument("--sign", required=True)

    args = parser.parse_args()

    commands = {
        "status": status_cmd,
        "book": book_cmd,
        "return": return_cmd,
        "block": block_cmd,
        "unblock": unblock_cmd,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

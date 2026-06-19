"""
Research competitor pricing and new entrants in the NZ party hire market.

Setup:
  Add PERPLEXITY_API_KEY to .env (copy from VS Studio/.env)

CLI usage:
  .venv/bin/python tools/research_competitors.py
  .venv/bin/python tools/research_competitors.py --category neon
  .venv/bin/python tools/research_competitors.py --category balloon
  .venv/bin/python tools/research_competitors.py --category photobooth
"""

import argparse
import os
import sys

import requests
from dotenv import load_dotenv

# Load from project .env first, then fall back to parent VS Studio .env
load_dotenv()
if not os.environ.get("PERPLEXITY_API_KEY"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

API_URL = "https://api.perplexity.ai/chat/completions"
MODEL = "sonar"

QUERIES = {
    "balloon": (
        "What are the current prices for balloon garland hire and DIY balloon garland kits "
        "from party hire businesses in Auckland, New Zealand in 2026? "
        "List business names, service types, and prices. Focus on Auckland and surrounding areas."
    ),
    "neon": (
        "What are the current prices for neon sign hire in Auckland, New Zealand in 2026? "
        "List business names, specific signs available, hire prices per period, and bond amounts."
    ),
    "photobooth": (
        "What are the current prices for photo booth hire in Auckland, New Zealand in 2026? "
        "List business names, package types (hours, features), and prices."
    ),
    "all": (
        "Give me a competitive overview of party hire businesses in Auckland, New Zealand in 2026. "
        "Focus on: balloon garland hire/DIY kits, neon sign hire, and photo booth hire. "
        "Include business names, pricing, and any notable offerings."
    ),
}


def research(question: str) -> dict:
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        print("Error: PERPLEXITY_API_KEY not set. Add it to .env")
        sys.exit(1)

    response = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a market research assistant for a small NZ party hire business. "
                        "Give concise, structured answers with specific prices and business names."
                    ),
                },
                {"role": "user", "content": question},
            ],
        },
        timeout=60,
    )

    if response.status_code != 200:
        print(f"API error ({response.status_code}): {response.text}")
        sys.exit(1)

    data = response.json()
    return {
        "answer": data["choices"][0]["message"]["content"],
        "citations": data.get("citations", []),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Research Auckland party hire competitors")
    parser.add_argument(
        "--category",
        choices=["balloon", "neon", "photobooth", "all"],
        default="all",
        help="Category to research (default: all)",
    )
    args = parser.parse_args()

    query = QUERIES[args.category]
    print(f"Researching: {args.category} competitors in Auckland NZ...\n")

    result = research(query)
    print(result["answer"])

    if result["citations"]:
        print("\nSources:")
        for url in result["citations"]:
            print(f"  - {url}")


if __name__ == "__main__":
    main()

"""
Search for neon sign (or other party product) suppliers from China.
Uses Perplexity to research suppliers, pricing, and sourcing tips.

CLI usage:
  .venv/bin/python tools/find_supplier.py --query "LED neon sign happy birthday"
  .venv/bin/python tools/find_supplier.py --query "balloon garland kit wholesale"
"""

import argparse
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()
if not os.environ.get("PERPLEXITY_API_KEY"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

API_URL = "https://api.perplexity.ai/chat/completions"
MODEL = "sonar"


def find_supplier(product_query: str) -> dict:
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        print("Error: PERPLEXITY_API_KEY not set. Add it to .env")
        sys.exit(1)

    question = (
        f"I want to source '{product_query}' from Chinese suppliers on Alibaba or similar platforms "
        f"to resell or hire in New Zealand. I need: "
        f"1) Recommended supplier types or company names, "
        f"2) Typical price range per unit in USD, "
        f"3) Minimum order quantities, "
        f"4) Typical lead time to New Zealand, "
        f"5) Any quality or sourcing tips specific to this product. "
        f"Keep it practical for a small NZ business spending $200-500 NZD on a first order."
    )

    response = requests.post(
        API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a sourcing advisor helping a small New Zealand party hire business "
                        "find reliable, affordable suppliers from China. Give practical, specific advice."
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
    parser = argparse.ArgumentParser(description="Find product suppliers for Hooray HQ")
    parser.add_argument("--query", required=True, help='Product to source, e.g. "LED neon sign happy birthday"')
    args = parser.parse_args()

    print(f"Researching suppliers for: {args.query}\n")
    result = find_supplier(args.query)
    print(result["answer"])

    if result["citations"]:
        print("\nSources:")
        for url in result["citations"]:
            print(f"  - {url}")


if __name__ == "__main__":
    main()

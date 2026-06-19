"""
Draft Instagram/TikTok captions and hashtag sets using Claude API.

Setup:
  Add ANTHROPIC_API_KEY to .env

CLI usage:
  .venv/bin/python tools/draft_social_post.py --occasion "birthday balloon garland install" --style instagram
  .venv/bin/python tools/draft_social_post.py --occasion "neon sign hire happy birthday" --style tiktok
  .venv/bin/python tools/draft_social_post.py --occasion "DIY kit dispatch" --style instagram --count 3
"""

import argparse
import os
import sys

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = "claude-haiku-4-5-20251001"

BRAND_CONTEXT = """
You are writing social media content for Hooray HQ, a party hire business based in Whangaparaoa, Auckland, New Zealand.

Business: Balloon garland installs, neon sign hire, and (coming soon) photo booth hire.
Brand voice: Warm, enthusiastic, and a little cheeky. Like a friend who loves a good party.
Audience: Mainly Auckland mums and event planners, aged 25–45, planning birthdays, baby showers, hen parties, corporate events.
Tone: Never corporate. Use first names where possible. Short sentences. Genuine excitement.
Always end with a call to action: DM for a quote, tag a friend, or ask a question.
Always include: #hoorayhq #aucklandparty #nzparty and 5-10 relevant additional hashtags.
"""

STYLE_INSTRUCTIONS = {
    "instagram": (
        "Write a single Instagram caption. Max 150 words. Include 1 line break before the hashtags. "
        "Start with a hook (not 'We' or 'Our'). End with a specific call to action. "
        "Add 8-12 relevant hashtags on a new line at the end."
    ),
    "tiktok": (
        "Write a TikTok caption and a suggested on-screen text hook for the first 2 seconds. "
        "Caption: max 100 words, punchy, use trending language. "
        "Hook: one sentence that grabs attention immediately (e.g. 'POV: ...' or 'Watch me...'). "
        "Add 5-8 hashtags. Format as: HOOK: [text]\n\nCAPTION: [text]\n\nHASHTAGS: [tags]"
    ),
}


def draft_post(occasion: str, style: str, count: int = 1) -> list[str]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY not set. Add it to .env")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    prompt = (
        f"Write {count} different {style} post(s) for this occasion/product: '{occasion}'.\n\n"
        f"{STYLE_INSTRUCTIONS[style]}\n\n"
        f"If writing multiple posts, separate them with '---'."
    )

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=BRAND_CONTEXT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    posts = [p.strip() for p in raw.split("---") if p.strip()]
    return posts


def main() -> None:
    parser = argparse.ArgumentParser(description="Draft social media posts for Hooray HQ")
    parser.add_argument("--occasion", required=True, help='What the post is about, e.g. "birthday balloon install"')
    parser.add_argument(
        "--style",
        choices=["instagram", "tiktok"],
        default="instagram",
        help="Platform style (default: instagram)",
    )
    parser.add_argument("--count", type=int, default=1, help="Number of variations to generate (default: 1)")
    args = parser.parse_args()

    print(f"Drafting {args.count} {args.style} post(s) for: {args.occasion}\n{'─' * 50}\n")

    posts = draft_post(args.occasion, args.style, args.count)
    for i, post in enumerate(posts, 1):
        if len(posts) > 1:
            print(f"Option {i}:\n")
        print(post)
        print()


if __name__ == "__main__":
    main()

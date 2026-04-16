#!/usr/bin/env python3
"""
Exercise POST /chat against a running local API (uvicorn).

Run from repo root (backend-ai):
  python tests/sample_conversations.py

Requires: uvicorn on http://127.0.0.1:8000 (e.g. python -m uvicorn src.app:app --reload)
"""

from __future__ import annotations

import json
import sys
from typing import Any

import requests

CHAT_URL = "http://127.0.0.1:8000/chat"
TIMEOUT_S = 120


# --- Sample payloads: different players, states, and emotional setups ---

# 1) High morale: player riding momentum after a strong run; fan energy matches.
HIGH_MORALE: dict[str, Any] = {
    "player_id": "son",
    "message": (
        "That last performance was incredible. We’re so proud—keep that energy "
        "for the next one."
    ),
    "cultivation_state": {
        "confidence": 82,
        "form": 86,
        "morale": 92,
        "fan_bond": 88,
    },
    "history": [
        {"role": "user", "content": "Big game coming—how are you feeling?"},
        {"role": "assistant", "content": "Good. Legs feel strong. I want to repay the support."},
    ],
}

# 2) Post-injury low morale: return to pitch anxiety, confidence dented, fan still careful.
POST_INJURY_LOW: dict[str, Any] = {
    "player_id": "messi",
    "message": (
        "Take it slow—no rush. How’s the body holding up day to day?"
    ),
    "cultivation_state": {
        "confidence": 38,
        "form": 42,
        "morale": 28,
        "fan_bond": 72,
    },
    "history": [
        {"role": "user", "content": "Rough stretch with the injury news."},
        {"role": "assistant", "content": "Yeah. Not easy. Just trying to do the work quietly."},
    ],
}

# 3) Pre-final pressure: big match looming; sharp form but nerves and weight of the moment.
PRE_FINAL_PRESSURE: dict[str, Any] = {
    "player_id": "bellingham",
    "message": (
        "Final in a few days—millions watching. What’s the mindset going in?"
    ),
    "cultivation_state": {
        "confidence": 64,
        "form": 81,
        "morale": 52,
        "fan_bond": 68,
    },
    "history": [
        {"role": "user", "content": "Tough draw in the semis—glad you pulled through."},
        {"role": "assistant", "content": "We dug in. Still work to do as a group."},
    ],
}


CASES: list[tuple[str, str, dict[str, Any]]] = [
    (
        "1) High morale (momentum + proud fan)",
        "Tests upbeat tone when morale/confidence/form are high; Son persona, warm fan bond.",
        HIGH_MORALE,
    ),
    (
        "2) Post-injury low morale (cautious recovery)",
        "Tests hesitant, minimal voice when morale/confidence are low; Messi persona, gentle fan check-in.",
        POST_INJURY_LOW,
    ),
    (
        "3) Pre-final pressure (sharp but tense)",
        "Tests leadership/team framing under stakes: solid form, mixed morale; Bellingham, final-night framing.",
        PRE_FINAL_PRESSURE,
    ),
]


def main() -> None:
    for title, comment, payload in CASES:
        print()
        print("=" * 72)
        print(title)
        print(f"# {comment}")
        print("-" * 72)
        print("REQUEST JSON:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print("-" * 72)

        try:
            resp = requests.post(CHAT_URL, json=payload, timeout=TIMEOUT_S)
        except requests.RequestException as exc:
            print(f"REQUEST FAILED: {exc}", file=sys.stderr)
            print("Is the server running?  uvicorn src.app:app --reload", file=sys.stderr)
            sys.exit(1)

        print(f"HTTP {resp.status_code}")
        try:
            data = resp.json()
        except json.JSONDecodeError:
            print("RESPONSE (not JSON):", resp.text[:2000])
            continue

        print("RESPONSE:")
        print("  reply:")
        reply = data.get("reply", "")
        for line in str(reply).splitlines():
            print(f"    {line}")
        ad = data.get("attribute_deltas", {})
        print("  attribute_deltas:")
        print(f"    confidence: {ad.get('confidence')}")
        print(f"    form: {ad.get('form')}")
        print(f"    morale: {ad.get('morale')}")
        print(f"    fan_bond: {ad.get('fan_bond')}")

    print()
    print("=" * 72)
    print("Done.")


if __name__ == "__main__":
    main()

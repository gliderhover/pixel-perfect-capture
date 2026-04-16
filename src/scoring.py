from collections.abc import Mapping
from typing import Any
import re


# Keep scoring conservative so one message cannot swing attributes too much.
DEFAULT_MIN_DELTA = -8
DEFAULT_MAX_DELTA = 8

# Tunable keyword buckets.
# Phrase buckets are matched by substring; token buckets are matched by token equality.
SUPPORTIVE_PHRASES = {
    "you can",
    "you can do this",
    "you are ready",
    "you're ready",
    "keep going",
    "you got this",
    "stay strong",
    "trust yourself",
    "great job",
    "well done",
    "proud of you",
    "with confidence",
    "i believe in you",
    # Gentle / recovery / interview care (often no hype words)
    "take it slow",
    "no rush",
    "day to day",
    "day by day",
    "holding up",
    "how's the body",
    "how is the body",
    "how you feeling",
    "glad you",
}
SUPPORTIVE_TOKENS = {
    "elite",
    "proud",
    "support",
    "believe",
    "strong",
    "confidence",
    "confident",
}

MOTIVATIONAL_PHRASES = {
    "let's win",
    "go for it",
    "bounce back",
    "come back stronger",
    "next match",
    "attack the",
    "attack the next",
    "big game",
    "big match",
}
MOTIVATIONAL_TOKENS = {
    "fight",
    "push",
    "focus",
    "sharp",
    "dominate",
    "champion",
    "win",
    "ready",
    "attack",
    "final",
    "semis",
    "pressure",
}

TACTICAL_PHRASES = {
    "final third",
    "time your runs",
    "decision making",
    "first touch",
    "passing lane",
}
TACTICAL_TOKENS = {
    "positioning",
    "press",
    "transition",
    "tempo",
    "shape",
    "compact",
    "finishing",
    "patient",
    "runs",
    "mindset",
    "preparation",
}

FAN_SUPPORT_PHRASES = {
    "we are with you",
    "always support",
    "i support you",
    "we believe in you",
    "no matter what",
    "with you",
}
FAN_SUPPORT_TOKENS = {
    "support",
    "believe",
    "together",
    "always",
}

NEGATIVE_PHRASES = {
    "shut up",
    "hurry up",
    "do your job",
    "stop making excuses",
    "why are you so bad",
}
NEGATIVE_TOKENS = {
    "awful",
    "useless",
    "lazy",
    "stupid",
    "pathetic",
    "trash",
    "terrible",
    "disappointing",
}

# When nothing above matches but the message is still clearly upbeat (no insults).
SOFT_POSITIVE_TOKENS = {
    "great",
    "amazing",
    "fantastic",
    "brilliant",
    "excellent",
    "incredible",
    "superb",
    "hope",
    "proud",
    "love",
    "better",
    "yes",
    "well",
    "good",
    "nice",
    "super",
}


def clamp_delta(value: int, min_value: int = -8, max_value: int = 8) -> int:
    if value < min_value:
        return min_value
    if value > max_value:
        return max_value
    return value


def _normalize_text(text: str) -> str:
    s = text.lower()
    # Curly quotes → ASCII so phrase matches (e.g. How's / What’s in fan messages).
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace(
        "\u201d", '"'
    )
    return re.sub(r"\s+", " ", s).strip()


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z']+", text.lower()))


def _count_phrase_hits(text: str, phrases: set[str]) -> int:
    return sum(1 for phrase in phrases if phrase in text)


def _count_token_hits(tokens: set[str], keywords: set[str]) -> int:
    return sum(1 for keyword in keywords if keyword in tokens)


def compute_attribute_deltas(
    message: str,
    cultivation_state: Mapping[str, Any],
    persona: Mapping[str, Any],
) -> dict[str, int]:
    """
    Compute small, deterministic deltas from one user message.

    Notes for teammates:
    - Only message tone/content is scored here.
    - cultivation_state and persona are read-only context for future tuning.
    - We return ints and never mutate external state.
    """
    # Normalize once for deterministic phrase + token matching.
    text = _normalize_text(message)
    tokens = _tokenize(text)

    supportive_hits = _count_phrase_hits(text, SUPPORTIVE_PHRASES) + _count_token_hits(
        tokens, SUPPORTIVE_TOKENS
    )
    motivational_hits = _count_phrase_hits(
        text, MOTIVATIONAL_PHRASES
    ) + _count_token_hits(tokens, MOTIVATIONAL_TOKENS)
    tactical_hits = _count_phrase_hits(text, TACTICAL_PHRASES) + _count_token_hits(
        tokens, TACTICAL_TOKENS
    )
    fan_hits = _count_phrase_hits(text, FAN_SUPPORT_PHRASES) + _count_token_hits(
        tokens, FAN_SUPPORT_TOKENS
    )
    negative_hits = _count_phrase_hits(text, NEGATIVE_PHRASES) + _count_token_hits(
        tokens, NEGATIVE_TOKENS
    )

    # One sentence can match many overlapping phrases; cap so deltas stay small.
    supportive_hits = min(supportive_hits, 3)
    motivational_hits = min(motivational_hits, 3)
    tactical_hits = min(tactical_hits, 3)
    fan_hits = min(fan_hits, 3)
    negative_hits = min(negative_hits, 4)

    confidence = 0
    form = 0
    morale = 0
    fan_bond = 0

    # Supportive language mostly builds confidence and morale.
    confidence += supportive_hits * 1
    morale += supportive_hits * 1

    # Motivational language gives extra morale lift and some confidence.
    confidence += motivational_hits * 1
    morale += motivational_hits * 2

    # Tactical/performance advice mainly helps form, with a slight confidence bump.
    form += tactical_hits * 2
    confidence += tactical_hits * 1

    # Loyal and empathetic fan support mostly improves fan bond and morale.
    fan_bond += fan_hits * 2
    morale += fan_hits * 1

    # Rude/dismissive language harms morale and fan bond the most.
    morale -= negative_hits * 2
    fan_bond -= negative_hits * 2
    confidence -= negative_hits * 1

    # If the message is strongly negative, form focus also tends to drop slightly.
    if negative_hits >= 2:
        form -= 1

    # Mild persona-aware tweak:
    # if persona style is warm, positive fan messages connect a bit better.
    relationship_style = str(persona.get("relationship_style_with_fan", "")).lower()
    if fan_hits > 0 and ("warm" in relationship_style or "friendly" in relationship_style):
        fan_bond += 1

    # Mild state-aware tweak:
    # when morale is already very low, supportive tone matters slightly more.
    morale_now = int(cultivation_state.get("morale", 50))
    if morale_now < 35 and (supportive_hits + motivational_hits) > 0:
        morale += 1

    # Fallback: short upbeat fan lines often miss fixed phrases—give a tiny bump if
    # nothing scored yet and there are no negative hits.
    total_bucket_hits = (
        supportive_hits + motivational_hits + tactical_hits + fan_hits
    )
    if negative_hits == 0 and total_bucket_hits == 0:
        soft_hits = _count_token_hits(tokens, SOFT_POSITIVE_TOKENS)
        if soft_hits:
            morale += 1
            confidence += 1

    return {
        "confidence": int(clamp_delta(confidence, DEFAULT_MIN_DELTA, DEFAULT_MAX_DELTA)),
        "form": int(clamp_delta(form, DEFAULT_MIN_DELTA, DEFAULT_MAX_DELTA)),
        "morale": int(clamp_delta(morale, DEFAULT_MIN_DELTA, DEFAULT_MAX_DELTA)),
        "fan_bond": int(clamp_delta(fan_bond, DEFAULT_MIN_DELTA, DEFAULT_MAX_DELTA)),
    }

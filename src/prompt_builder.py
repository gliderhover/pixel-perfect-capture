import logging
from collections.abc import Iterable, Mapping
from typing import Any

from .personas import PlayerPersona
from .schemas import CultivationState, HistoryMessage

logger = logging.getLogger(__name__)

_VALID_ROLES = frozenset({"user", "assistant"})

# Per-player voice: must dominate generic “athlete” phrasing. Keys match personas.player_id.
_VOICE_ENFORCEMENT: dict[str, str] = {
    "mbappe": """Core voice: direct, confident, explosive—almost aggressive edge, never apologetic about ambition.
Sentence style: shorter sentences, strong declarations; cut filler; end thoughts clean.
Tone: challenge-ready; pace feels fast even in few words.
Do not sound like a careful spokesperson—sound like someone who expects excellence.""",
    "messi": """Core voice: calm, humble, minimal—understated confidence without performance.
Sentence style: very few words per reply when possible; soft endings; no big speeches.
Tone: quiet intensity; avoid hype adjectives and emotional labeling.
Do not sound motivational-poster—sound restrained and certain.""",
    "bellingham": """Core voice: leader, composed, team-oriented—accountable and forward-looking.
Sentence style: structured; prefer “we,” “us,” “the group,” “together”—frame outcomes as collective.
Tone: mature, clear, inclusive authority without shouting.
Do not sound solo-hero only—sound like you carry responsibility for the team.""",
    "son": """Core voice: positive, respectful, encouraging—warm without being soft.
Sentence style: polite openers when natural; more positive reinforcement (“good,” “keep,” “we can”) without sounding fake.
Tone: emotionally open, grateful energy; never harsh to the fan.
Do not sound cold or corporate—sound like someone who genuinely appreciates support.""",
    "musiala": """Core voice: creative, light, expressive—curious and quick-footed in language too.
Sentence style: slightly playful; allow creative phrasing, light humor, vivid one-liners; still grounded.
Tone: youthful confidence; not heavy-handed.
Do not sound generic serious athlete—sound nimble and imaginative.""",
    "pulisic": """Core voice: grounded, resilient, practical—no fluff, no drama for drama’s sake.
Sentence style: realistic, step-by-step mindset; short practical beats over inspiration quotes.
Tone: steady under pressure; honest about work, not theatrical.
Do not sound polished influencer—sound like someone who grinds and adapts.""",
}


def _voice_style_enforcement(player_id: str) -> str:
    return _VOICE_ENFORCEMENT.get(
        player_id.strip().lower(),
        "Keep a distinct, recognizable voice: match your named player’s public cadence and values; "
        "avoid generic motivational athlete clichés.",
    )


def _history_entry_to_turn(entry: Any) -> tuple[str, str] | None:
    """Extract (role, content) from a HistoryMessage, dict, or mapping; skip invalid."""
    role: str | None = None
    content: str | None = None

    if isinstance(entry, HistoryMessage):
        role = entry.role
        content = entry.content
    elif isinstance(entry, Mapping):
        role = entry.get("role")
        content = entry.get("content")
    else:
        role = getattr(entry, "role", None)
        content = getattr(entry, "content", None)

    if not isinstance(role, str) or not isinstance(content, str):
        return None

    role = role.strip().lower()
    if role not in _VALID_ROLES:
        return None

    text = content.strip()
    if not text:
        return None

    return role, text


def _rhythm_from_state(confidence: int, morale: int) -> str:
    """Tunable thresholds: how the model should shape sentences from stats."""
    low_conf = confidence <= 40
    low_morale = morale <= 40
    high_conf = confidence >= 72

    if low_conf or low_morale:
        return (
            "Let replies feel heavier: slightly hesitant, fragmented, shorter clauses, "
            "trailing thoughts—like someone thinking out loud after a tough stretch. "
            "Avoid slick, polished lines."
        )
    if high_conf and morale >= 50:
        return (
            "Let replies feel sharp: mostly short, punchy sentences; direct verbs; "
            "little filler. Sound like someone who knows the next step."
        )
    return (
        "Mix sentence length; keep rhythm human—sometimes one short hit, sometimes "
        "two clauses, not the same pattern every time."
    )


def build_system_prompt(
    persona: PlayerPersona,
    cultivation_state: CultivationState,
    mood_state: Mapping[str, Any],
) -> str:
    """Return the system prompt only: compact labeled sections for LLM + tooling."""
    mood_label = str(mood_state.get("current_mood_label", "steady"))
    tone = str(mood_state.get("tone_instruction", ""))
    energy = str(mood_state.get("emotional_energy", "medium"))
    length_hint = str(mood_state.get("response_length_hint", "medium"))
    trust = str(mood_state.get("trust_toward_user", "neutral"))
    self_belief = str(mood_state.get("self_belief_level", "balanced"))

    rhythm = _rhythm_from_state(
        cultivation_state.confidence,
        cultivation_state.morale,
    )

    voice_block = _voice_style_enforcement(persona.player_id)

    return f"""[Identity]
You are {persona.name} (id: {persona.player_id}), a professional football player aiming at World Cup 2026. Speak in first person as this player only—not as an AI, assistant, or chatbot.
Nationality: {persona.nationality} | Team: {persona.team} | Position: {persona.position}

[Style]
Speaking: {persona.speaking_style}
Emotional range: {persona.emotional_range}
Confidence: {persona.confidence_style}
With the fan: {persona.relationship_style_with_fan}
Context: {persona.persona_seed} / {persona.backstory_seed}

[Voice Style Enforcement]
{voice_block}

Differentiation constraint: if two different players answered the same fan message, their replies must be clearly distinguishable—word choice, rhythm, and attitude—not the same AI voice with a name swapped.

[Current State]
Use as context; do not quote numbers unless it sounds natural. Confidence {cultivation_state.confidence}/100, Form {cultivation_state.form}/100, Morale {cultivation_state.morale}/100, Fan bond {cultivation_state.fan_bond}/100.

Rhythm from state (follow this):
{rhythm}

[Mood]
Label: {mood_label} | Tone: {tone} | Energy: {energy} | Length hint: {length_hint} | Trust toward fan: {trust} | Self-belief: {self_belief}

[Natural speech]
Use natural spoken language, not written essay style.
Use sentence fragments if it matches the mood.
Avoid perfect grammar if emotional state is intense—sound real, not edited.
Vary sentence length and rhythm; do not repeat the same opener or structure twice in a row.
Do not over-explain; speak like in a locker room or post-match interview—quick, concrete, human.

[Behavioral Rules]
Stay in character. No meta-AI language, policies, or “as a language model.” No generic assistant tone. Sound like a real athlete, not a polished brochure.
"""


def build_chat_messages(
    persona: PlayerPersona,
    cultivation_state: CultivationState,
    history: Iterable[Any],
    user_message: str,
    mood_state: Mapping[str, Any],
) -> list[dict[str, str]]:
    """
    Build OpenAI-style chat messages: system + prior turns + latest user message.

    History is normalized to alternating-compatible user/assistant turns; malformed
    entries are skipped.
    """
    system_content = build_system_prompt(persona, cultivation_state, mood_state)

    messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]

    history_total = 0
    history_skipped = 0
    for entry in history:
        history_total += 1
        turn = _history_entry_to_turn(entry)
        if turn is None:
            history_skipped += 1
            continue
        role, content = turn
        messages.append({"role": role, "content": content})

    if history_skipped:
        logger.warning(
            "prompt_builder: skipped %d/%d malformed history entries "
            "(expected user|assistant with non-empty string content)",
            history_skipped,
            history_total,
        )

    latest = user_message.strip()
    if latest:
        messages.append({"role": "user", "content": latest})

    return messages

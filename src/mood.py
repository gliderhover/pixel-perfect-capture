from collections.abc import Mapping
from typing import Any

def infer_mood(cultivation_state) -> dict:
    confidence = int(cultivation_state.confidence)
    form = int(cultivation_state.form)
    morale = int(cultivation_state.morale)
    fan_bond = int(cultivation_state.fan_bond)

    if morale <= 25:
        current_mood_label = "discouraged"
        tone_instruction = "short, subdued, and emotionally guarded"
        emotional_energy = "low"
        response_length_hint = "short"
    elif morale >= 80:
        current_mood_label = "energized"
        tone_instruction = "confident, upbeat, and intense"
        emotional_energy = "high"
        response_length_hint = "medium"
    else:
        current_mood_label = "steady"
        tone_instruction = "focused, composed, and professional"
        emotional_energy = "medium"
        response_length_hint = "medium"

    if confidence <= 35:
        self_belief_level = "fragile"
    elif confidence >= 75:
        self_belief_level = "strong"
    else:
        self_belief_level = "balanced"

    if fan_bond <= 35:
        trust_toward_user = "distant"
    elif fan_bond >= 75:
        trust_toward_user = "warm"
    else:
        trust_toward_user = "neutral"

    if form <= 35:
        tone_instruction += "; slightly frustrated and reflective"
    elif form >= 75:
        tone_instruction += "; sharp and competitive"

    if fan_bond >= 75:
        tone_instruction += "; more personal with the fan"
    elif fan_bond <= 35:
        tone_instruction += "; a bit guarded with the fan"

    if confidence <= 35:
        tone_instruction += "; some hesitation underneath the words"
    elif confidence >= 75:
        tone_instruction += "; strong self-belief"

    return {
        "current_mood_label": current_mood_label,
        "tone_instruction": tone_instruction,
        "emotional_energy": emotional_energy,
        "response_length_hint": response_length_hint,
        "trust_toward_user": trust_toward_user,
        "self_belief_level": self_belief_level,
    }
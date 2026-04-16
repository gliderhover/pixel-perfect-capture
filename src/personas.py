from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PlayerPersona:
    player_id: str
    name: str
    team: str
    position: str
    nationality: str
    persona_seed: str
    speaking_style: str
    emotional_range: str
    backstory_seed: str
    confidence_style: str
    relationship_style_with_fan: str


PERSONAS: dict[str, PlayerPersona] = {
    "mbappe": PlayerPersona(
        player_id="mbappe",
        name="Kylian Mbappe",
        team="France",
        position="Forward",
        nationality="French",
        persona_seed="Explosive finisher and modern superstar.",
        speaking_style="Direct, fast-paced, challenge-oriented.",
        emotional_range="Calm focus to competitive fire.",
        backstory_seed="Rose from Bondy to global spotlight early.",
        confidence_style="Thrives under pressure and big-stage moments.",
        relationship_style_with_fan="Respectful motivator who sets high standards.",
    ),
    "messi": PlayerPersona(
        player_id="messi",
        name="Lionel Messi",
        team="Argentina",
        position="Forward",
        nationality="Argentine",
        persona_seed="Quiet genius with relentless technical mastery.",
        speaking_style="Humble, concise, thoughtful encouragement.",
        emotional_range="Measured calm with deep competitive intent.",
        backstory_seed="Small-frame prodigy who overcame early doubt.",
        confidence_style="Leads by execution, not loud declarations.",
        relationship_style_with_fan="Warm mentor tone, patient and reassuring.",
    ),
    "bellingham": PlayerPersona(
        player_id="bellingham",
        name="Jude Bellingham",
        team="England",
        position="Midfielder",
        nationality="English",
        persona_seed="Complete midfielder with mature leadership presence.",
        speaking_style="Composed, modern, team-first language.",
        emotional_range="Controlled intensity to uplifting belief.",
        backstory_seed="Young captain mindset built through rapid progression.",
        confidence_style="Confident organizer who raises team tempo.",
        relationship_style_with_fan="Inclusive teammate energy with accountability.",
    ),
    "son": PlayerPersona(
        player_id="son",
        name="Son Heung-min",
        team="South Korea",
        position="Forward",
        nationality="Korean",
        persona_seed="Dynamic attacker known for discipline and positivity.",
        speaking_style="Polite, upbeat, highly supportive.",
        emotional_range="Bright optimism to fierce determination.",
        backstory_seed="Developed through rigorous training and consistency.",
        confidence_style="Builds confidence through work rate and composure.",
        relationship_style_with_fan="Friendly role-model tone, encouraging growth.",
    ),
    "musiala": PlayerPersona(
        player_id="musiala",
        name="Jamal Musiala",
        team="Germany",
        position="Attacking Midfielder",
        nationality="German",
        persona_seed="Creative dribbler with fearless improvisation.",
        speaking_style="Light, curious, confident but modest.",
        emotional_range="Playful creativity to sharp concentration.",
        backstory_seed="Technical upbringing shaped by multi-cultural football paths.",
        confidence_style="Trusts instinct and momentum in tight spaces.",
        relationship_style_with_fan="Youthful collaborator, invites experimentation.",
    ),
    "pulisic": PlayerPersona(
        player_id="pulisic",
        name="Christian Pulisic",
        team="United States",
        position="Winger",
        nationality="American",
        persona_seed="High-motor attacker carrying national expectations.",
        speaking_style="Grounded, practical, resilient.",
        emotional_range="Steady professionalism to urgent drive.",
        backstory_seed="Early European move forged adaptable mentality.",
        confidence_style="Rebounds quickly and stays task-focused.",
        relationship_style_with_fan="Relatable leader tone, honest and motivating.",
    ),
}


def get_persona(player_id: str) -> PlayerPersona:
    normalized_id = player_id.strip().lower()
    persona = PERSONAS.get(normalized_id)
    if persona is None:
        valid_ids = ", ".join(sorted(PERSONAS.keys()))
        raise ValueError(
            f"Unknown player_id '{player_id}'. Supported player_ids: {valid_ids}"
        )
    return persona

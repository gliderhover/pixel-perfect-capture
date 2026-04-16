from dataclasses import asdict
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

# Load backend-ai/.env even if uvicorn was started from another cwd (e.g. repo root).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .schemas import AttributeDeltas, ChatRequest, ChatResponse
from .llm_client import generate_reply, sanitize_reply_text
from .personas import get_persona
from .mood import infer_mood
from .prompt_builder import build_chat_messages
from .scoring import compute_attribute_deltas

logger = logging.getLogger(__name__)

app = FastAPI(title="AI Conversation & Personality Engine", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    try:
        persona = get_persona(payload.player_id)
    except ValueError as exc:
        logger.warning("chat rejected unknown player_id=%r: %s", payload.player_id, exc)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "unknown_player_id",
                "message": str(exc),
            },
        ) from exc

    mood_state = infer_mood(payload.cultivation_state)
    attribute_deltas = compute_attribute_deltas(
        payload.message,
        payload.cultivation_state.model_dump(),
        asdict(persona),
    )

    chat_messages = build_chat_messages(
        persona,
        payload.cultivation_state,
        payload.history,
        payload.message,
        mood_state,
    )

    reply_source = "gemini"
    try:
        reply = sanitize_reply_text(generate_reply(chat_messages))
    except Exception as exc:
        logger.warning(
            "Gemini generation failed for player_id=%r; using in-character fallback: %s",
            payload.player_id,
            exc,
        )
        reply_source = "fallback"
        reply = sanitize_reply_text(
            f"{persona.name} here — I'm locked in for {persona.team}. "
            f"I hear you. I'm taking it one session at a time and staying ready "
            f"for what's next."
        )

    logger.info(
        "chat_ok player_id=%s mood=%s reply_chars=%d source=%s attribute_deltas=%s",
        persona.player_id,
        mood_state.get("current_mood_label"),
        len(reply),
        reply_source,
        attribute_deltas,
    )

    return ChatResponse(
        reply=reply,
        attribute_deltas=AttributeDeltas(
            confidence=attribute_deltas["confidence"],
            form=attribute_deltas["form"],
            morale=attribute_deltas["morale"],
            fan_bond=attribute_deltas["fan_bond"],
        ),
    )
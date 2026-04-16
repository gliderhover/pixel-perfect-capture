from typing import Literal

from pydantic import BaseModel, Field


Role = Literal["user", "assistant"]


class CultivationState(BaseModel):
    confidence: int = Field(ge=0, le=100)
    form: int = Field(ge=0, le=100)
    morale: int = Field(ge=0, le=100)
    fan_bond: int = Field(ge=0, le=100)


class AttributeDeltas(BaseModel):
    """Per-message changes; can be negative (matches scoring clamp in scoring.py)."""

    confidence: int = Field(ge=-8, le=8)
    form: int = Field(ge=-8, le=8)
    morale: int = Field(ge=-8, le=8)
    fan_bond: int = Field(ge=-8, le=8)


class HistoryMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    player_id: str = Field(min_length=1)
    message: str = Field(min_length=1)
    cultivation_state: CultivationState
    history: list[HistoryMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    attribute_deltas: AttributeDeltas

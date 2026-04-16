"""Gemini client wrapper (google-genai). Swap models or providers here."""

from __future__ import annotations

import os
import re
import unicodedata
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google.genai import Client, types
from google.genai import errors as genai_errors

# Default model; override per process with env ``GEMINI_MODEL``.
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

_client: Client | None = None


def sanitize_reply_text(text: str) -> str:
    """
    Normalize model output for safe JSON and UI display: Unicode, line endings,
    invisible characters, and stray control bytes that can look like “garbled” text.
    """
    if not text:
        return ""
    s = unicodedata.normalize("NFKC", text)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = re.sub(r"[\u200b-\u200d\ufeff\u2060]", "", s)
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def get_gemini_client() -> Client:
    """Return a cached Client using ``GEMINI_API_KEY`` from the environment."""
    global _client
    if _client is None:
        # Same file as app: backend-ai/.env (works even if process cwd is not backend-ai).
        load_dotenv(Path(__file__).resolve().parent.parent / ".env")
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to your environment or .env file."
            )
        _client = Client(api_key=api_key)
    return _client


def _gemini_role(role: str) -> str | None:
    r = role.strip().lower()
    if r == "user":
        return "user"
    if r == "assistant":
        return "model"
    return None


def _normalize_messages(
    messages: list[dict[str, Any]],
) -> tuple[str | None, list[types.Content]]:
    """Split system instruction(s) from conversation; build Gemini ``Content`` list."""
    system_parts: list[str] = []
    contents: list[types.Content] = []

    for raw in messages:
        if not isinstance(raw, dict):
            continue
        role = raw.get("role")
        content = raw.get("content")
        if not isinstance(role, str) or not isinstance(content, str):
            continue
        text = content.strip()
        if not text:
            continue

        if role.strip().lower() == "system":
            system_parts.append(text)
            continue

        g_role = _gemini_role(role)
        if g_role is None:
            continue

        contents.append(
            types.Content(
                role=g_role,
                parts=[types.Part.from_text(text=text)],
            )
        )

    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, contents


def generate_reply(messages: list[dict[str, Any]]) -> str:
    """
    Call Gemini with chat-shaped dicts and return plain assistant text.

    Expected shape::

        [
            {"role": "system", "content": "..."},
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."},
        ]

    The system message(s) are sent as ``system_instruction``; other turns keep
    order. ``assistant`` is mapped to Gemini's ``model`` role.
    """
    system_instruction, contents = _normalize_messages(messages)
    if not contents:
        raise ValueError(
            "No valid user/assistant turns after normalization; need at least one message."
        )

    config = (
        types.GenerateContentConfig(system_instruction=system_instruction)
        if system_instruction
        else None
    )

    client = get_gemini_client()

    model_name = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=config,
        )
    except genai_errors.APIError as exc:
        raise RuntimeError(f"Gemini API request failed: {exc}") from exc
    except Exception as exc:
        raise RuntimeError(f"Unexpected error calling Gemini: {exc}") from exc

    text = getattr(response, "text", None)
    if isinstance(text, str) and text.strip():
        return sanitize_reply_text(text)

    if response.prompt_feedback:
        raise RuntimeError(
            f"Model returned no text (prompt feedback: {response.prompt_feedback})"
        )

    raise RuntimeError("Model returned empty text with no usable candidates.")

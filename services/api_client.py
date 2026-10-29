"""
services/api_client.py — Single-provider LLM + Image-generation orchestrator.

Exposes a unified ``ProviderClient`` interface backed by either:
  • GeminiProvider  (Gemini text + Imagen 3 image)
  • AnthropicProvider  (Claude text + DALL-E 3 image)

Every provider returns a standardised dict with keys:
  lyrics, image_prompt, render_spec, background_bytes
"""

from __future__ import annotations

import abc
import base64
import io
import json
import re
from typing import Any

from rich.console import Console

from config import (
    ANTHROPIC_TEXT_MODEL,
    DALLE_MODEL,
    GEMINI_IMAGE_MODEL,
    GEMINI_TEXT_MODEL,
    get_key,
)

console = Console()


# ── Unified interface ──────────────────────────────────────────────────────────

class ProviderClient(abc.ABC):
    """Abstract base for AI provider back-ends."""

    @abc.abstractmethod
    def generate_spec(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        """Call the text LLM and return the parsed JSON spec dict."""

    @abc.abstractmethod
    def generate_image(self, prompt: str) -> bytes:
        """Generate a 16:9 background image and return raw PNG bytes."""


# ── Gemini provider ───────────────────────────────────────────────────────────

class GeminiProvider(ProviderClient):
    """Uses google-genai SDK for both text (Gemini) and image generation."""

    def __init__(
        self,
        text_model: str = GEMINI_TEXT_MODEL,
        image_model: str = GEMINI_IMAGE_MODEL,
    ) -> None:
        from google import genai
        self._client = genai.Client(api_key=get_key("GEMINI_API_KEY"))
        self._text_model = text_model
        self._image_model = image_model

    # ── Text ───────────────────────────────────────────────────────────────
    def generate_spec(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        from google.genai import types

        response = self._client.models.generate_content(
            model=self._text_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.8,
                response_mime_type="application/json",
            ),
        )
        return _parse_json(response.text)

    # ── Image ──────────────────────────────────────────────────────────────
    def generate_image(self, prompt: str) -> bytes:
        """
        Generate a 16:9 background image using generate_content with
        response_modalities=["IMAGE"].  This is the current SDK approach
        for Gemini Developer API (generate_images is Vertex/Enterprise only).
        """
        from google.genai import types

        response = self._client.models.generate_content(
            model=self._image_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio="16:9",
                ),
            ),
        )

        for part in response.parts:
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data

        raise RuntimeError(
            "Image model returned no image data. "
            f"Model used: {self._image_model!r}. "
            "Response text: " + (response.text or "<empty>")
        )


# ── Anthropic + DALL-E provider ────────────────────────────────────────────────

class AnthropicProvider(ProviderClient):
    """Uses Anthropic Claude for text and OpenAI DALL-E 3 for images."""

    def __init__(self) -> None:
        import anthropic
        import openai

        self._anthropic = anthropic.Anthropic(api_key=get_key("ANTHROPIC_API_KEY"))
        self._openai = openai.OpenAI(api_key=get_key("OPENAI_API_KEY"))

    # ── Text ───────────────────────────────────────────────────────────────
    def generate_spec(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        message = self._anthropic.messages.create(
            model=ANTHROPIC_TEXT_MODEL,
            max_tokens=4096,
            temperature=0.8,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text
        return _parse_json(raw)

    # ── Image ──────────────────────────────────────────────────────────────
    def generate_image(self, prompt: str) -> bytes:
        response = self._openai.images.generate(
            model=DALLE_MODEL,
            prompt=prompt,
            size="1792x1024",  # closest 16:9 DALL-E 3 supports
            quality="hd",
            response_format="b64_json",
            n=1,
        )
        b64 = response.data[0].b64_json
        return base64.b64decode(b64)


# ── Factory ────────────────────────────────────────────────────────────────────

def build_provider(
    provider_name: str,
    gemini_text_model: str = GEMINI_TEXT_MODEL,
    gemini_image_model: str = GEMINI_IMAGE_MODEL,
) -> ProviderClient:
    """Instantiate the correct provider by name."""
    if provider_name == "gemini":
        return GeminiProvider(
            text_model=gemini_text_model,
            image_model=gemini_image_model,
        )
    if provider_name == "anthropic":
        return AnthropicProvider()
    raise ValueError(f"Unknown provider: {provider_name}")


# ── JSON parsing helper ───────────────────────────────────────────────────────

def _parse_json(raw: str) -> dict[str, Any]:
    """
    Best-effort extraction of a JSON object from LLM output.

    Handles markdown fences and leading/trailing prose.
    """
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw)
    cleaned = cleaned.strip().rstrip("`")

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find the outermost { … }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Failed to parse JSON from LLM response:\n{raw[:500]}")


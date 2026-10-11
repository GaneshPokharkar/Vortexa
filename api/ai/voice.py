"""ElevenLabs Agents: server side of the voice tutor. The API key never leaves the server.

The browser asks /voice/session; we exchange ELEVENLABS_API_KEY for a short-lived signed URL
(GET /v1/convai/conversation/get-signed-url, valid ~15 min) and the React SDK connects with it.
"""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger("learnloop.voice")
SIGNED_URL = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"


def _config() -> tuple[str | None, str | None]:
    return os.environ.get("ELEVENLABS_API_KEY"), os.environ.get("ELEVENLABS_AGENT_ID")


def status() -> dict:
    key, agent = _config()
    if key and agent:
        return {"live": True, "note": "ElevenLabs voice tutor configured."}
    missing = [n for n, v in (("ELEVENLABS_API_KEY", key), ("ELEVENLABS_AGENT_ID", agent)) if not v]
    return {"live": False, "note": f"Voice not configured: set {' and '.join(missing)} in api/.env. Text tutoring works."}


def signed_url() -> dict:
    key, agent = _config()
    if not (key and agent):
        return {"available": False, "signed_url": None, "reason": status()["note"]}
    try:
        res = httpx.get(SIGNED_URL, params={"agent_id": agent}, headers={"xi-api-key": key}, timeout=8.0)
    except httpx.HTTPError as e:
        log.warning("ElevenLabs unreachable: %s", e)
        return {"available": False, "signed_url": None, "reason": "Can't reach ElevenLabs right now. Use text instead."}
    if res.status_code != 200:
        log.warning("ElevenLabs signed URL failed: %s", res.status_code)
        reason = "ElevenLabs rejected the credentials." if res.status_code in (401, 403) else \
            f"ElevenLabs answered {res.status_code}. Use text instead."
        return {"available": False, "signed_url": None, "reason": reason}
    url = res.json().get("signed_url")
    return {"available": bool(url), "signed_url": url, "reason": None if url else "No signed URL returned."}

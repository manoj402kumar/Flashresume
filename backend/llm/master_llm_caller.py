import os
from dotenv import load_dotenv
from .gemini_fallback     import call_gemini,     call_gemini_with_model
from .mistral_fallback    import call_mistral,    call_mistral_with_model
from .groq_fallback       import call_groq,       call_groq_with_model
from .cerebras_fallback   import call_cerebras,   call_cerebras_with_model
from .cloudflare_fallback import call_cloudflare, call_cloudflare_with_model

load_dotenv()

ENV_PREFERRED = os.getenv("PREFERRED_LLM", "gemini").lower()

GEMINI_PREFIXES     = ("gemini-", "gemma-")
MISTRAL_PREFIXES    = ("mistral-", "open-mistral-", "ministral-", "codestral-", "pixtral-")
GROQ_PREFIXES       = (
    "openai/gpt-oss-",
    "llama-3.3-",
    "llama-3.1-8b-instant",
    "meta-llama/",
    "qwen/qwen3-",
)
CEREBRAS_EXACT      = {"qwen-3-235b-a22b", "llama3.1-8b"}
CLOUDFLARE_PREFIXES = ("llama-3.1-8b-instruct", "cf-mistral-7b-instruct")

_DEFAULT_CHAIN = [
    ("gemini",     call_gemini),
    ("mistral",    call_mistral),
    ("groq",       call_groq),
    ("cerebras",   call_cerebras),
    ("cloudflare", call_cloudflare),
]


def _build_chain(lead_provider: str, lead_caller) -> list:
    rest = [(name, fn) for name, fn in _DEFAULT_CHAIN if name != lead_provider]
    return [(lead_provider, lead_caller)] + rest


def call_llm(prompt: str, preferred_model: str = None) -> dict:
    """
    Master LLM caller with 5-provider / 21-model fallback chain.

    preferred_model accepts:
      - a provider name  : "gemini" | "mistral" | "groq" | "cerebras" | "cloudflare"
      - a specific model : "mistral-large-latest", "gemini-2.5-flash",
                           "openai/gpt-oss-120b", "llama-3.1-8b-instruct", etc.

    Default order: Gemini → Mistral → Groq → Cerebras → Cloudflare
    """
    all_attempts = []
    active = (preferred_model or ENV_PREFERRED).lower()

    if any(active.startswith(p) for p in GEMINI_PREFIXES):
        chain = _build_chain("gemini", lambda p: call_gemini_with_model(p, active))

    elif any(active.startswith(p) for p in MISTRAL_PREFIXES):
        chain = _build_chain("mistral", lambda p: call_mistral_with_model(p, active))

    elif any(active.startswith(p) for p in GROQ_PREFIXES):
        chain = _build_chain("groq", lambda p: call_groq_with_model(p, active))

    elif active in CEREBRAS_EXACT:
        chain = _build_chain("cerebras", lambda p: call_cerebras_with_model(p, active))

    elif any(active.startswith(p) for p in CLOUDFLARE_PREFIXES):
        chain = _build_chain("cloudflare", lambda p: call_cloudflare_with_model(p, active))

    elif active == "gemini":
        chain = _build_chain("gemini", call_gemini)
    elif active == "mistral":
        chain = _build_chain("mistral", call_mistral)
    elif active == "groq":
        chain = _build_chain("groq", call_groq)
    elif active == "cerebras":
        chain = _build_chain("cerebras", call_cerebras)
    elif active == "cloudflare":
        chain = _build_chain("cloudflare", call_cloudflare)
    else:
        chain = _DEFAULT_CHAIN

    for provider_name, caller in chain:
        result = caller(prompt)
        all_attempts.extend(result.get("attempts", []))
        if result["success"]:
            return {
                "success":      True,
                "text":         result["text"],
                "model":        result["model"],
                "provider":     provider_name,
                "speed":        result["speed"],
                "all_attempts": all_attempts,
            }

    return {
        "success":      False,
        "text":         None,
        "model":        None,
        "provider":     None,
        "speed":        None,
        "all_attempts": all_attempts,
    }

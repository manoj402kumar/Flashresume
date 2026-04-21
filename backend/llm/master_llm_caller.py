import os
import json
from dotenv import load_dotenv
from .gemini_fallback import call_gemini, call_gemini_with_model
from .mistral_fallback import call_mistral, call_mistral_with_model
from .groq_fallback import call_groq, call_groq_with_model
from .cerebras_fallback import call_cerebras, call_cerebras_with_model

load_dotenv()

ENV_PREFERRED = os.getenv("PREFERRED_LLM", "gemini").lower()


def call_llm(prompt: str, preferred_model: str = None) -> dict:
    """
    Master LLM caller with 4-provider fallback chain.
    preferred_model can be:
      - a provider name: "gemini", "mistral", "groq", or "cerebras"
      - a specific model ID: "mistral-large-latest", "gemini-2.5-flash", etc.
    Provider order: Gemini -> Mistral -> Groq -> Cerebras (default)
    """
    all_attempts = []
    active_pref = (preferred_model or ENV_PREFERRED).lower()

    MISTRAL_PREFIXES   = ("mistral-", "open-mistral-", "ministral-", "codestral-", "pixtral-")
    GEMINI_PREFIXES    = ("gemini-", "gemma-")
    GROQ_PREFIXES      = ("llama-", "llama3-", "llama3.", "mixtral-", "qwen-", "gemma2-", "llama-4")
    CEREBRAS_PREFIXES  = ("llama-3.3-70b", "qwen-3-", "llama3.1-", "gpt-oss-")

    if any(active_pref.startswith(p) for p in MISTRAL_PREFIXES):
        chain = [
            ("mistral",  lambda p: call_mistral_with_model(p, active_pref)),
            ("gemini",   call_gemini),
            ("groq",     call_groq),
            ("cerebras", call_cerebras),
        ]
    elif any(active_pref.startswith(p) for p in GEMINI_PREFIXES):
        chain = [
            ("gemini",   lambda p: call_gemini_with_model(p, active_pref)),
            ("mistral",  call_mistral),
            ("groq",     call_groq),
            ("cerebras", call_cerebras),
        ]
    elif any(active_pref.startswith(p) for p in CEREBRAS_PREFIXES):
        chain = [
            ("cerebras", lambda p: call_cerebras_with_model(p, active_pref)),
            ("groq",     call_groq),
            ("mistral",  call_mistral),
            ("gemini",   call_gemini),
        ]
    elif any(active_pref.startswith(p) for p in GROQ_PREFIXES):
        chain = [
            ("groq",     lambda p: call_groq_with_model(p, active_pref)),
            ("mistral",  call_mistral),
            ("gemini",   call_gemini),
            ("cerebras", call_cerebras),
        ]
    elif active_pref == "mistral":
        chain = [("mistral", call_mistral), ("gemini", call_gemini), ("groq", call_groq), ("cerebras", call_cerebras)]
    elif active_pref == "groq":
        chain = [("groq", call_groq), ("mistral", call_mistral), ("gemini", call_gemini), ("cerebras", call_cerebras)]
    elif active_pref == "cerebras":
        chain = [("cerebras", call_cerebras), ("groq", call_groq), ("mistral", call_mistral), ("gemini", call_gemini)]
    else:
        chain = [("gemini", call_gemini), ("mistral", call_mistral), ("groq", call_groq), ("cerebras", call_cerebras)]

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




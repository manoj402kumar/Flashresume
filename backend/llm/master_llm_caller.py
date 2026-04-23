from dotenv import load_dotenv
from .gemini_fallback     import call_gemini_r1,     call_gemini_r2
from .mistral_fallback    import call_mistral_r1,    call_mistral_r2
from .groq_fallback       import call_groq_r1,       call_groq_r2
from .cerebras_fallback   import call_cerebras_r1,   call_cerebras_r2
from .cloudflare_fallback import call_cloudflare_r1, call_cloudflare_r2

load_dotenv()

# Request-1 provider order (ATS scoring + project check)
# Priority: speed + accuracy for analysis tasks
_R1_CHAIN = [
    ("groq",       call_groq_r1),
    ("cerebras",   call_cerebras_r1),
    ("mistral",    call_mistral_r1),
    ("gemini",     call_gemini_r1),
    ("cloudflare", call_cloudflare_r1),
]

# Request-2 provider order (resume generation)
# Priority: highest quality structured JSON output
_R2_CHAIN = [
    ("groq",       call_groq_r2),
    ("cerebras",   call_cerebras_r2),
    ("mistral",    call_mistral_r2),
    ("gemini",     call_gemini_r2),
    ("cloudflare", call_cloudflare_r2),
]


def _run_chain(prompt: str, chain: list) -> dict:
    """Walk the provider chain until one succeeds."""
    all_attempts = []
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


def call_llm_r1(prompt: str) -> dict:
    """
    Request-1 LLM call — ATS scoring + project relevance check.
    Chain: Groq → Cerebras → Mistral → Gemini → Cloudflare
    """
    return _run_chain(prompt, _R1_CHAIN)


def call_llm_r2(prompt: str) -> dict:
    """
    Request-2 LLM call — resume generation.
    Chain: Groq → Cerebras → Mistral → Gemini → Cloudflare
    """
    return _run_chain(prompt, _R2_CHAIN)

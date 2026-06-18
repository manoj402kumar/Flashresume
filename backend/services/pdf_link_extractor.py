"""
PDF Hyperlink Extractor
=======================
Extracts real hyperlink URLs embedded as /URI annotation objects in a PDF —
the kind that are invisible to plain text extraction engines like pypdfium2 or
pdfplumber (e.g. a word "GitHub" that is clickable but the URL is hidden inside
the PDF annotation dict, not the character stream).

Two-pass strategy
-----------------
Pass 1 — pypdfium2 annotation walk
    Iterates every page's link annotations and collects raw /URI values.
    These are the gold-standard source: actual hyperlinks the author embedded.

Pass 2 — Regex fallback on extracted text
    Scans the plain-text output of the parser for URL patterns.
    Catches URLs that were typed as visible text (not as hyperlinks).

Merge rule: Pass 1 wins. Pass 2 only fills buckets that Pass 1 left empty.

Returns
-------
{
    "linkedin":  str | None,   # heading LinkedIn profile URL
    "github":    str | None,   # heading GitHub profile URL (profile root, not repo)
    "portfolio": str | None,   # heading portfolio / personal site URL
    "all_urls":  list[str],    # ALL valid http/https URLs found (for LLM project-link matching)
}
"""

import re
import gc
from typing import Optional
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode
import io
from pypdf import PdfReader


# ── Regex patterns for Pass 2 (plain text fallback) ──────────────────────────
_TEXT_URL_PATTERNS: list[re.Pattern] = [
    # LinkedIn profile
    re.compile(
        r'(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+(?:/[\w\-]*)?',
        re.I
    ),
    # GitHub profile or repo path
    re.compile(
        r'(?:https?://)?(?:www\.)?github\.com/[\w\-][\w\-\.]*(?:/[\w\-\.]+)*/?',
        re.I
    ),
    # GitHub Pages personal/project site
    re.compile(
        r'(?:https?://)?[\w\-]+\.github\.io(?:/[\w\-\.]*)*/?',
        re.I
    ),
    # Generic http/https URLs — catches portfolio sites, Vercel, etc.
    re.compile(
        r'https?://(?:www\.)?[\w\-][\w\-\.]*\.[a-z]{2,10}(?:/[\w\-\./\?=&#%+@!~]*)?',
        re.I
    ),
]

# URI schemes that are NOT web URLs — skip these entirely
_SKIP_SCHEMES = frozenset({'mailto', 'tel', 'sms', 'file', 'ftp', 'data', 'javascript'})

# Query-string tracking parameters to strip (privacy + cleanliness)
_TRACKING_PARAMS = frozenset({
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'utm_id', 'original_referer', 'trk', 'ref', 'ref_',
    'fbclid', 'gclid', 'msclkid', 'mc_eid',
})


# ── URI normalizer ────────────────────────────────────────────────────────────

def _normalize_uri(raw: str) -> Optional[str]:
    """
    Normalize a raw URI string:
    1. Strip whitespace / null bytes.
    2. Reject non-web schemes (mailto, tel, file, …).
    3. Add https:// if scheme is missing.
    4. Reject non-http(s) schemes after coercion.
    5. Reject URIs without a valid netloc.
    6. Strip known tracking query parameters.
    7. Force scheme to https.
    8. Strip fragment (#anchor) — irrelevant for resume links.
    9. Strip trailing slash from path (except bare domain).
    Returns None if the URI is not a usable web URL.
    """
    raw = raw.strip().strip('\x00\r\n')
    if not raw:
        return None

    # Skip non-web schemes immediately
    colon_idx = raw.find(':')
    if colon_idx != -1:
        scheme_candidate = raw[:colon_idx].lower()
        if scheme_candidate in _SKIP_SCHEMES:
            return None

    # Add scheme if missing
    if not re.match(r'^https?://', raw, re.I):
        raw = 'https://' + raw

    try:
        parsed = urlparse(raw)
    except Exception:
        return None

    if parsed.scheme.lower() not in ('http', 'https'):
        return None

    netloc = parsed.netloc.lower()
    if not netloc or '.' not in netloc:
        return None

    # Strip tracking params
    if parsed.query:
        qs = parse_qs(parsed.query, keep_blank_values=True)
        cleaned = {k: v for k, v in qs.items() if k.lower() not in _TRACKING_PARAMS}
        new_query = urlencode(cleaned, doseq=True)
    else:
        new_query = ''

    # Rebuild with normalized parts
    normalized = urlunparse((
        'https',            # force https
        netloc,
        parsed.path.rstrip('/') if parsed.path != '/' else '/',
        parsed.params,
        new_query,
        '',                 # strip fragment
    ))
    return normalized


# ── Pass 1: pypdfium2 annotation walk ────────────────────────────────────────

def _walk_annotations(pdf_bytes: bytes) -> list[str]:
    """
    Iterate every page's link annotations and return raw URI strings.
    Skips problematic pages silently — never raises.
    Uses pypdf, which is a pure-python dictionary parser. It consumes virtually
    zero RAM compared to pdfplumber, making it safe for low-memory Render instances.
    """
    uris: list[str] = []
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page in reader.pages:
            try:
                annots = page.get('/Annots')
                if not annots:
                    continue
                # Annots can be an ArrayObject of IndirectObjects
                for annot in annots:
                    annot_obj = annot.get_object()
                    if annot_obj.get('/Subtype') == '/Link':
                        a_dict = annot_obj.get('/A')
                        if a_dict:
                            uri = a_dict.get('/URI')
                            if uri:
                                uris.append(str(uri))
            except Exception:
                continue  # bad page — skip, keep iterating
    except Exception as e:
        print(f"[pdf_link_extractor] pypdf fallback failed: {e}")
    return uris


# ── Pass 2: regex fallback on extracted text ─────────────────────────────────

def _regex_scan(text: str) -> list[str]:
    """
    Scan plain text for URL-like strings using compiled regex patterns.
    Returns raw matches (not yet normalized).
    """
    found: list[str] = []
    seen_spans: set[int] = set()
    for pattern in _TEXT_URL_PATTERNS:
        for m in pattern.finditer(text):
            # Avoid overlapping matches from different patterns
            if m.start() not in seen_spans:
                seen_spans.add(m.start())
                found.append(m.group(0))
    return found


# ── Result builder ────────────────────────────────────────────────────────────

def _build_result(raw_uris: list[str]) -> dict:
    """
    Normalize and deduplicate raw URI strings into the output dict.
    """
    all_urls: list[str] = []
    seen: set[str] = set()

    for raw in raw_uris:
        normalized = _normalize_uri(raw)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        all_urls.append(normalized)

    return {
        'all_urls':  all_urls,
    }


# ── Public API ────────────────────────────────────────────────────────────────

def extract_pdf_links(pdf_bytes: bytes, resume_text: str = '') -> dict:
    """
    Main entry point. Extract hyperlinks from a PDF via two-pass strategy.

    Parameters
    ----------
    pdf_bytes   : Raw bytes of the PDF file.
    resume_text : Already-extracted plain text from the PDF (used for Pass 2 fallback).

    Returns
    -------
    dict with keys:
        all_urls  : list[str]   — All valid https:// URLs found (for matching)

    Never raises. On any failure, returns the empty-result dict.
    """
    _EMPTY = {'all_urls': []}

    if not pdf_bytes:
        return _EMPTY

    try:
        # ── Pass 1: Annotation walk ───────────────────────────────────────
        annotation_uris = _walk_annotations(pdf_bytes)

        # ── Pass 2: Regex fallback on extracted text ─────────────────────
        text_uris = _regex_scan(resume_text) if resume_text else []

        # ── Merge: Pass 1 first (higher priority), then Pass 2 ──────────
        # _build_result deduplicates so Pass 1 wins on any overlapping URL.
        all_raw = annotation_uris + text_uris

        return _build_result(all_raw)

    except Exception as exc:
        # Non-fatal — degraded gracefully. Never propagate.
        print(f"[pdf_link_extractor] WARNING: non-fatal error during extraction: {exc}")
        return _EMPTY

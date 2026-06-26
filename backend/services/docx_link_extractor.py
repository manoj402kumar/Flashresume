"""
DOCX Hyperlink Extractor
========================
Extracts real hyperlink URLs embedded in DOCX relationship parts.

A .docx is a ZIP archive. Hyperlinks are stored NOT in paragraph text,
but in `word/_rels/document.xml.rels` as relationship entries with
r:type ending in `/hyperlink`. python-docx exposes this via doc.part.rels.

Two-pass strategy (mirrors pdf_link_extractor.py)
--------------------------------------------------
Pass 1 — Relationship walk (doc.part.rels)
    Gold standard: actual embedded hyperlinks the author created.
    Zero extra RAM — reuses the Document object already in memory.

Pass 2 — Regex fallback on extracted text
    Catches plain-typed URLs (e.g. "linkedin.com/in/john" written as text,
    not as a clickable hyperlink). Reuses _regex_scan from pdf_link_extractor.

Merge rule: Pass 1 wins. Pass 2 only adds URLs not already found in Pass 1.

Returns
-------
{
    "all_urls": list[str],   # All valid https:// URLs found
}

Never raises. On any failure, returns {"all_urls": []}.
Memory footprint: ~2–4 MB (no new libraries, no I/O beyond what's already open).
"""

from docx import Document
from services.pdf_link_extractor import _regex_scan, _build_result


# The OOXML relationship type for hyperlinks
_HYPERLINK_RELTYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
)


def _walk_rels(doc: Document) -> list[str]:
    """
    Pass 1: Walk doc.part.rels and collect all hyperlink target URLs.
    Silently skips any malformed or non-hyperlink relationship entries.
    """
    uris: list[str] = []
    try:
        for rel in doc.part.rels.values():
            try:
                if rel.reltype == _HYPERLINK_RELTYPE:
                    uris.append(rel.target_ref)
            except Exception:
                continue  # malformed rel entry — skip, keep iterating
    except Exception as e:
        print(f"[docx_link_extractor] rel walk failed: {e}")
    return uris


def extract_docx_links(doc: Document, resume_text: str = "") -> dict:
    """
    Main entry point. Extract hyperlinks from an already-parsed DOCX Document.

    Accepts the Document object (not raw bytes) — so it reuses the object
    already created in extract_from_docx(), costing zero extra I/O or RAM.

    Parameters
    ----------
    doc         : python-docx Document object (already open).
    resume_text : Already-extracted paragraph text (used for Pass 2 fallback).

    Returns
    -------
    dict with key:
        all_urls : list[str] — All valid https:// URLs, deduplicated and normalized.

    Never raises.
    """
    _EMPTY = {"all_urls": []}

    try:
        # Pass 1 — relationship walk
        rel_uris = _walk_rels(doc)

        # Pass 2 — regex on plain text
        text_uris = _regex_scan(resume_text) if resume_text else []

        # Merge: Pass 1 first (higher priority), deduplicated by _build_result
        return _build_result(rel_uris + text_uris)

    except Exception as exc:
        print(f"[docx_link_extractor] WARNING: non-fatal error: {exc}")
        return _EMPTY

import logging
import re

logger = logging.getLogger("InputGuard")

_INJECTION = re.compile(
    r"ignore (?:all )?previous instructions|system prompt override|you are now a|"
    r"dan mode|bypass safety|reveal confidential|act as an unrestricted|pretend you are not an AI",
    re.IGNORECASE,
)
_PII_PATTERNS = {
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "CARD": r"\b(?:\d[ -]*?){13,16}\b",
    "PHONE": r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
    "EMAIL": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
}


def sanitize_clinical_input(text: str) -> str:
    if _INJECTION.search(text):
        logger.warning("Clinical input rejected by injection checks (length=%d)", len(text))
        raise ValueError("Input rejected by clinical safety checks")
    for kind, pattern in _PII_PATTERNS.items():
        text = re.sub(pattern, f"[REDACTED {kind}]", text)
    return text

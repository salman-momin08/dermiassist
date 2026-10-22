"""
Circuit Breaker Resilience Pattern for External APIs (Gemini, Hugging Face).
Manages state transitions: CLOSED -> OPEN -> HALF_OPEN
Prevents cascade failures during external API rate limiting or regional outages.
"""

import time
import asyncio
from typing import Dict, Any, Callable, Awaitable, TypeVar

T = TypeVar("T")

class CircuitBreakerOpenException(Exception):
    """Raised when circuit is OPEN and calls are tripped."""
    pass

class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 3, reset_timeout_seconds: float = 30.0):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout_seconds = reset_timeout_seconds
        
        self.state = "CLOSED"  # CLOSED | OPEN | HALF_OPEN
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.success_count = 0

    def can_execute(self) -> bool:
        """Check if request can be executed based on state."""
        if self.state == "HALF_OPEN":
            return False
        now = time.time()
        if self.state == "OPEN":
            if now - self.last_failure_time > self.reset_timeout_seconds:
                self.state = "HALF_OPEN"
                return True
            return False
        return True

    def record_success(self):
        """Record successful call execution."""
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.failure_count = 0
        self.failure_count = 0

    def record_failure(self):
        """Record failed call execution."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"

    def get_status(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "state": self.state,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "reset_timeout_seconds": self.reset_timeout_seconds
        }

# Pre-instantiated Circuit Breakers for AI Services
gemini_circuit_breaker = CircuitBreaker("Gemini-API", failure_threshold=3, reset_timeout_seconds=30.0)
huggingface_circuit_breaker = CircuitBreaker("HuggingFace-API", failure_threshold=3, reset_timeout_seconds=30.0)
openai_circuit_breaker = CircuitBreaker("OpenAI-API", failure_threshold=3, reset_timeout_seconds=30.0)


async def with_circuit_breaker(breaker: "CircuitBreaker", coro_fn: Callable[..., Awaitable[T]], *args: Any, **kwargs: Any) -> T:
    """
    Shared circuit-breaker wrapper for any async provider call.

    Checks `can_execute()` before calling, then records success/failure based on
    the outcome. Raises `CircuitBreakerOpenException` immediately (without
    calling `coro_fn`) if the breaker is OPEN, so callers can fall back to
    another provider without waiting for a doomed call to time out.
    """
    if not breaker.can_execute():
        raise CircuitBreakerOpenException(f"Circuit breaker OPEN for {breaker.name}")
    try:
        result = await coro_fn(*args, **kwargs)
    except asyncio.CancelledError:
        breaker.record_failure()
        raise
    except Exception:
        breaker.record_failure()
        raise
    breaker.record_success()
    return result

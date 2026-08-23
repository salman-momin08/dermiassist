"""
SSRF guard for server-side fetches of caller-supplied URLs (e.g. image_url).

Any endpoint that takes a URL from a request and fetches it server-side is a
potential SSRF vector — a caller could point it at cloud metadata endpoints
(169.254.169.254) or internal-network services. This validates the URL's
scheme and resolves its host, rejecting anything that lands on a private,
loopback, link-local, reserved, or multicast address before the real fetch
is attempted.
"""

import socket
import ipaddress
from urllib.parse import urlparse


class UnsafeUrlError(ValueError):
    """Raised when a caller-supplied URL is not safe to fetch server-side."""


def assert_public_http_url(url: str) -> None:
    """Raise UnsafeUrlError if `url` is not a safe public http(s) URL to fetch."""
    if not url:
        raise UnsafeUrlError("No URL provided")

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError(f"Unsupported URL scheme: {parsed.scheme!r}")
    if not parsed.hostname:
        raise UnsafeUrlError("URL has no hostname")

    try:
        addr_infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as e:
        raise UnsafeUrlError(f"Could not resolve host: {parsed.hostname}") from e

    for family, _, _, _, sockaddr in addr_infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            raise UnsafeUrlError(f"URL resolves to a non-public address: {ip}")

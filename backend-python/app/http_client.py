import os
import requests

_DEFAULT_CA_BUNDLE = "/etc/ssl/certs/ca-certificates.crt"
_session: requests.Session | None = None

def get_http_session() -> requests.Session:
    """
    Shared HTTP session for all outbound requests.
    Forces a stable CA bundle path inside containers, while still allowing override via env.
    """
    global _session
    if _session is None:
        s = requests.Session()
        s.verify = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE") or _DEFAULT_CA_BUNDLE
        _session = s
    return _session
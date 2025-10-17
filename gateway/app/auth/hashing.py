# medical-ai-hospital/gateway/app/auth/hashing.py

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import SecretStr

_hasher = PasswordHasher()  # sensible defaults

def hash_password(plain: SecretStr) -> str:
    """Hashes a password after extracting its plain string value."""
    return _hasher.hash(plain.get_secret_value())

def verify_password(plain: SecretStr, hashed: str) -> bool:
    """Verifies a password against a hash."""
    try:
        # Also get the secret value here for verification
        return _hasher.verify(hashed, plain.get_secret_value())
    except VerifyMismatchError:
        return False
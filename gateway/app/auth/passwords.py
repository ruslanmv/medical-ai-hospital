# gateway/app/auth/passwords.py
from __future__ import annotations

from typing import Union

from pydantic import SecretStr
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerificationError, VerifyMismatchError

# Argon2id via argon2-cffi; tune for your infra as needed
_ph = PasswordHasher(
    time_cost=3,           # iterations
    memory_cost=64 * 1024, # KiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)

Plain = Union[str, SecretStr]


def _to_plain(pw: Plain) -> str:
    return pw.get_secret_value() if isinstance(pw, SecretStr) else pw


def hash_password(plain_password: Plain) -> str:
    """
    Hash a password and return a PHC-formatted Argon2id string:
    $argon2id$v=19$m=65536,t=3,p=2$<salt>$<hash>
    """
    return _ph.hash(_to_plain(plain_password))


def verify_password(plain_password: Plain, password_hash: str) -> bool:
    """
    Return True if the plaintext matches the stored Argon2 hash.
    """
    try:
        return _ph.verify(password_hash, _to_plain(plain_password))
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHash):
        # corrupted / unsupported / not argon2
        return False

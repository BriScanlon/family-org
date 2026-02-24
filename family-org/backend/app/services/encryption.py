from cryptography.fernet import Fernet
import base64
import hashlib
from ..config import settings


def _get_fernet() -> Fernet:
    # Derive a 32-byte key from SECRET_KEY
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()

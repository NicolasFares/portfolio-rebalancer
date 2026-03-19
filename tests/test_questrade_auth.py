"""Tests for Questrade token encryption at rest."""

import json
import logging

import pytest
from cryptography.fernet import Fernet

from backend import questrade_auth


SAMPLE_TOKEN = {
    "access_token": "test_access",
    "refresh_token": "test_refresh",
    "api_server": "https://api05.iq.questrade.com/",
    "expires_at": 9999999999,
}


@pytest.fixture()
def token_file(tmp_path, monkeypatch):
    """Point TOKEN_FILE at a temporary path and return it."""
    path = tmp_path / "token.json"
    monkeypatch.setattr(questrade_auth, "TOKEN_FILE", path)
    return path


def test_write_and_read_encrypted(token_file):
    """Written token file should be encrypted (not valid JSON) and readable back."""
    questrade_auth._write_token(SAMPLE_TOKEN)

    raw = token_file.read_bytes()
    # Raw bytes should NOT be valid JSON (it's Fernet ciphertext)
    with pytest.raises((json.JSONDecodeError, UnicodeDecodeError)):
        json.loads(raw)

    # But _read_token should decrypt it correctly
    result = questrade_auth._read_token()
    assert result == SAMPLE_TOKEN


def test_plaintext_migration(token_file, monkeypatch):
    """A legacy plaintext token file should be auto-encrypted on first read."""
    # Write plaintext directly (simulating pre-encryption state)
    token_file.write_text(json.dumps(SAMPLE_TOKEN, indent=2))

    result = questrade_auth._read_token()
    assert result == SAMPLE_TOKEN

    # File should now be encrypted on disk
    raw = token_file.read_bytes()
    with pytest.raises((json.JSONDecodeError, UnicodeDecodeError)):
        json.loads(raw)


def test_wrong_key_rejects(token_file):
    """Token encrypted with one key should not be readable with another."""
    questrade_auth._write_token(SAMPLE_TOKEN)

    # Swap in a different Fernet key
    other_fernet = Fernet(Fernet.generate_key())
    original_fernet = questrade_auth._fernet
    questrade_auth._fernet = other_fernet
    try:
        with pytest.raises(ValueError, match="corrupted or was encrypted with a different key"):
            questrade_auth._read_token()
    finally:
        questrade_auth._fernet = original_fernet


def test_auto_generate_key_logs_warning(caplog):
    """When no key is provided, _init_fernet should generate one and log a warning."""
    with caplog.at_level(logging.WARNING, logger="backend.questrade_auth"):
        f = questrade_auth._init_fernet(None)

    assert f is not None
    assert any("QUESTRADE_ENCRYPTION_KEY" in msg for msg in caplog.messages)
    assert any("Generated key:" in msg for msg in caplog.messages)


def test_init_fernet_with_valid_key():
    """A valid Fernet key should initialize without errors."""
    key = Fernet.generate_key().decode()
    f = questrade_auth._init_fernet(key)
    assert f is not None
    # Round-trip test
    data = b"hello"
    assert f.decrypt(f.encrypt(data)) == data


def test_init_fernet_with_invalid_key():
    """An invalid key should raise ValueError with a helpful message."""
    with pytest.raises(ValueError, match="not a valid Fernet key"):
        questrade_auth._init_fernet("not-a-valid-key")


def test_clear_token(token_file):
    """clear_token should delete the encrypted token file."""
    questrade_auth._write_token(SAMPLE_TOKEN)
    assert token_file.exists()

    questrade_auth.clear_token()
    assert not token_file.exists()


def test_read_nonexistent(token_file):
    """Reading when no file exists should return None."""
    assert questrade_auth._read_token() is None

"""
SecureFileVault - Zero-Knowledge File Encryption Layer

This module provides AES-256-GCM authenticated encryption for files before
cloud upload, ensuring zero-knowledge privacy. Files are encrypted locally
with a hardware-accelerated cryptographic primitive before transmission.

Security Features:
- AES-256-GCM authenticated encryption
- Unique 12-byte nonce per file
- Built-in integrity verification via GCM auth tag
- Explicit security exceptions for tampered/corrupted files
"""

import os
import zlib
import logging
from pathlib import Path
from typing import Optional
from cryptography.exceptions import InvalidTag, InvalidKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SecureVaultError(Exception):
    """Base exception for SecureFileVault errors."""
    pass


class InvalidKeyError(SecureVaultError):
    """Raised when the provided encryption key is invalid."""
    pass


class CorruptedPayloadError(SecureVaultError):
    """Raised when an encrypted payload has been tampered with or corrupted."""
    pass


class SecureFileVault:
    """
    Zero-knowledge file encryption vault using AES-256-GCM authenticated encryption.
    
    This class provides local encryption of files before cloud upload, ensuring
    that cloud providers never have access to unencrypted data.
    """
    
    NONCE_SIZE = 12  # 12 bytes for GCM nonce (recommended by NIST)
    KEY_SIZE = 32    # 32 bytes for AES-256 key
    COMPRESSION_LEVEL = 6  # zlib compression level (0-9, 6 is default balance)
    
    def __init__(self, master_key_hex: str):
        """
        Initialize the SecureFileVault with a master encryption key.
        
        Args:
            master_key_hex: 64-character hex string representing the 32-byte AES-256 key
            
        Raises:
            InvalidKeyError: If the key is not a valid 64-character hex string
        """
        if not isinstance(master_key_hex, str):
            raise InvalidKeyError("Master key must be a string")
        
        # Remove any whitespace or '0x' prefix
        master_key_hex = master_key_hex.strip().replace('0x', '')
        
        if len(master_key_hex) != self.KEY_SIZE * 2:
            raise InvalidKeyError(
                f"Master key must be {self.KEY_SIZE * 2}-character hex string (32 bytes), "
                f"got {len(master_key_hex)} characters"
            )
        
        try:
            # Convert hex string to bytes
            self.master_key = bytes.fromhex(master_key_hex)
        except ValueError as e:
            raise InvalidKeyError(f"Invalid hex string: {e}")
        
        # Initialize AES-GCM cipher
        try:
            self.cipher = AESGCM(self.master_key)
            logger.info("SecureFileVault initialized with AES-256-GCM")
        except Exception as e:
            raise InvalidKeyError(f"Failed to initialize AES-GCM cipher: {e}")
    
    def compress_data(self, data: bytes) -> bytes:
        """
        Compress data using zlib.
        
        Args:
            data: Raw data to compress
            
        Returns:
            Compressed data
            
        Raises:
            SecureVaultError: If compression fails
        """
        try:
            compressed = zlib.compress(data, level=self.COMPRESSION_LEVEL)
            compression_ratio = len(compressed) / len(data) if len(data) > 0 else 1
            logger.info(f"Compression: {len(data)} -> {len(compressed)} bytes (ratio: {compression_ratio:.2%})")
            return compressed
        except Exception as e:
            raise SecureVaultError(f"Compression failed: {e}")
    
    def decompress_data(self, compressed_data: bytes) -> bytes:
        """
        Decompress data using zlib.
        
        Args:
            compressed_data: Compressed data
            
        Returns:
            Decompressed data
            
        Raises:
            SecureVaultError: If decompression fails
        """
        try:
            decompressed = zlib.decompress(compressed_data)
            logger.info(f"Decompression: {len(compressed_data)} -> {len(decompressed)} bytes")
            return decompressed
        except zlib.error as e:
            raise SecureVaultError(f"Decompression failed: {e}")
    
    def encrypt_file(self, local_file_path: str) -> bytes:
        """
        Encrypt a file using AES-256-GCM authenticated encryption with compression.
        
        Args:
            local_file_path: Path to the local file to encrypt
            
        Returns:
            Encrypted binary payload: [12-byte nonce] + [ciphertext + 16-byte auth tag]
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            SecureVaultError: If encryption fails
        """
        file_path = Path(local_file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {local_file_path}")
        
        try:
            # Read file content
            with open(file_path, 'rb') as f:
                plaintext = f.read()
            
            logger.info(f"Encrypting file: {file_path.name} ({len(plaintext)} bytes)")
            
            # Compress data before encryption
            compressed_data = self.compress_data(plaintext)
            
            # Generate unique 12-byte nonce
            nonce = os.urandom(self.NONCE_SIZE)
            
            # Encrypt using AES-256-GCM
            # AESGCM.encrypt returns ciphertext with auth tag appended
            ciphertext_with_tag = self.cipher.encrypt(nonce, compressed_data, None)
            
            # Package payload: [nonce] + [ciphertext + auth tag]
            encrypted_payload = nonce + ciphertext_with_tag
            
            logger.info(f"Encrypted payload size: {len(encrypted_payload)} bytes")
            logger.info(f"  - Nonce: {self.NONCE_SIZE} bytes")
            logger.info(f"  - Ciphertext + Tag: {len(ciphertext_with_tag)} bytes")
            
            return encrypted_payload
            
        except InvalidKey as e:
            raise InvalidKeyError(f"Invalid encryption key: {e}")
        except Exception as e:
            raise SecureVaultError(f"Encryption failed for {file_path.name}: {e}")
    
    def decrypt_file(self, encrypted_payload: bytes, output_file_path: str) -> None:
        """
        Decrypt an encrypted payload and save to local file with decompression.
        
        Args:
            encrypted_payload: Encrypted binary payload: [12-byte nonce] + [ciphertext + 16-byte auth tag]
            output_file_path: Path where the decrypted file should be saved
            
        Raises:
            CorruptedPayloadError: If the payload has been tampered with or corrupted
            InvalidKeyError: If the decryption key is invalid
            SecureVaultError: If decryption fails
        """
        if len(encrypted_payload) < self.NONCE_SIZE:
            raise CorruptedPayloadError(
                f"Encrypted payload too short: {len(encrypted_payload)} bytes "
                f"(minimum {self.NONCE_SIZE} bytes required for nonce)"
            )
        
        try:
            # Extract nonce (first 12 bytes)
            nonce = encrypted_payload[:self.NONCE_SIZE]
            
            # Extract ciphertext + auth tag (remaining bytes)
            ciphertext_with_tag = encrypted_payload[self.NONCE_SIZE:]
            
            logger.info(f"Decrypting payload: {len(encrypted_payload)} bytes")
            logger.info(f"  - Nonce: {self.NONCE_SIZE} bytes")
            logger.info(f"  - Ciphertext + Tag: {len(ciphertext_with_tag)} bytes")
            
            # Decrypt using AES-256-GCM
            # This will automatically verify the auth tag and raise InvalidTag if corrupted
            compressed_data = self.cipher.decrypt(nonce, ciphertext_with_tag, None)
            
            # Decompress data after decryption
            plaintext = self.decompress_data(compressed_data)
            
            # Ensure output directory exists
            output_path = Path(output_file_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write decrypted file
            with open(output_path, 'wb') as f:
                f.write(plaintext)
            
            logger.info(f"Successfully decrypted to: {output_file_path} ({len(plaintext)} bytes)")
            
        except InvalidTag as e:
            # This is raised when the GCM auth tag verification fails
            # This means the file has been tampered with or corrupted
            raise CorruptedPayloadError(
                f"Integrity check failed - file has been tampered with or corrupted: {e}"
            )
        except InvalidKey as e:
            raise InvalidKeyError(f"Invalid decryption key: {e}")
        except Exception as e:
            raise SecureVaultError(f"Decryption failed: {e}")
    
    def encrypt_file_to_path(self, input_file_path: str, output_file_path: str) -> None:
        """
        Encrypt a file and save the encrypted payload to a specified path.
        
        Args:
            input_file_path: Path to the input file to encrypt
            output_file_path: Path where the encrypted payload should be saved
            
        Raises:
            FileNotFoundError: If the input file doesn't exist
            SecureVaultError: If encryption fails
        """
        encrypted_payload = self.encrypt_file(input_file_path)
        
        # Ensure output directory exists
        output_path = Path(output_file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write encrypted payload
        with open(output_path, 'wb') as f:
            f.write(encrypted_payload)
        
        logger.info(f"Encrypted file saved to: {output_file_path}")
    
    def decrypt_file_from_path(self, encrypted_file_path: str, output_file_path: str) -> None:
        """
        Decrypt an encrypted file and save to a specified path.
        
        Args:
            encrypted_file_path: Path to the encrypted payload file
            output_file_path: Path where the decrypted file should be saved
            
        Raises:
            FileNotFoundError: If the encrypted file doesn't exist
            CorruptedPayloadError: If the payload has been tampered with or corrupted
            SecureVaultError: If decryption fails
        """
        encrypted_path = Path(encrypted_file_path)
        
        if not encrypted_path.exists():
            raise FileNotFoundError(f"Encrypted file not found: {encrypted_file_path}")
        
        # Read encrypted payload
        with open(encrypted_path, 'rb') as f:
            encrypted_payload = f.read()
        
        # Decrypt and save
        self.decrypt_file(encrypted_payload, output_file_path)


# Utility functions for key generation
def generate_master_key() -> str:
    """
    Generate a cryptographically secure 32-byte AES-256 key and return as hex string.
    
    Returns:
        64-character hex string representing the 32-byte AES-256 key
        
    Warning:
        Store this key securely! Never commit it to version control.
    """
    key = os.urandom(SecureFileVault.KEY_SIZE)
    return key.hex()


def validate_key_format(key_hex: str) -> bool:
    """
    Validate that a key string is a properly formatted 64-character hex string.
    
    Args:
        key_hex: Key string to validate
        
    Returns:
        True if valid, False otherwise
    """
    try:
        key_hex = key_hex.strip().replace('0x', '')
        if len(key_hex) != SecureFileVault.KEY_SIZE * 2:
            return False
        bytes.fromhex(key_hex)
        return True
    except (ValueError, AttributeError):
        return False


# Example usage and testing
if __name__ == "__main__":
    # Example: Generate a new master key
    print("=== SecureFileVault Example ===\n")
    
    print("1. Generating a new master key:")
    master_key = generate_master_key()
    print(f"   Master Key (hex): {master_key}")
    print(f"   WARNING: Store this key securely!\n")
    
    # Example: Initialize vault
    print("2. Initializing SecureFileVault:")
    vault = SecureFileVault(master_key)
    print("   Vault initialized successfully\n")
    
    # Example: Encrypt a file
    print("3. Encrypting a file:")
    test_file = "test_document.txt"
    if os.path.exists(test_file):
        encrypted = vault.encrypt_file(test_file)
        print(f"   Encrypted payload size: {len(encrypted)} bytes\n")
        
        # Example: Decrypt the payload
        print("4. Decrypting the payload:")
        vault.decrypt_file(encrypted, "test_document_decrypted.txt")
        print("   Decryption successful\n")
    else:
        print(f"   Test file '{test_file}' not found. Create it to test encryption.\n")
    
    # Example: Validate key format
    print("5. Validating key format:")
    print(f"   Valid key: {validate_key_format(master_key)}")
    print(f"   Invalid key: {validate_key_format('invalid')}\n")

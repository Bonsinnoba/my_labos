import CryptoJS from 'crypto-js';

export class CryptoUtils {
  private static readonly IV_SIZE = 16; // 16 bytes for CBC IV
  private static readonly KEY_SIZE = 32; // 32 bytes for AES-256 key

  static validateKeyFormat(keyHex: string): boolean {
    try {
      const cleanKey = keyHex.trim().replace('0x', '');
      if (cleanKey.length !== this.KEY_SIZE * 2) {
        return false;
      }
      // Try to parse as hex
      parseInt(cleanKey, 16);
      return true;
    } catch (error) {
      return false;
    }
  }

  static compressData(data: string): string {
    // Standard CryptoJS doesn't include Zlib. Bypassing compression.
    return data;
  }

  static decompressData(compressedData: string): string {
    // Standard CryptoJS doesn't include Zlib. Bypassing decompression.
    return compressedData;
  }

  static encryptFile(fileData: string, encryptionKey: string): string {
    try {
      // Validate key format
      if (!this.validateKeyFormat(encryptionKey)) {
        throw new Error('Invalid encryption key format');
      }

      console.log(`Encrypting file data (${fileData.length} chars)`);

      // Compress data (no-op)
      const compressedData = this.compressData(fileData);

      // Generate random IV
      const iv = CryptoJS.lib.WordArray.random(this.IV_SIZE);

      // Convert hex key to WordArray
      const key = CryptoJS.enc.Hex.parse(encryptionKey);

      // Encrypt using AES-CBC
      const encrypted = CryptoJS.AES.encrypt(compressedData, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });

      // Combine IV + ciphertext
      const ivHex = CryptoJS.enc.Hex.stringify(iv);
      const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
      const combined = ivHex + ciphertextHex;

      console.log(`Encrypted payload size: ${combined.length} chars`);
      return combined;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  static decryptFile(encryptedPayload: string, encryptionKey: string): string {
    try {
      // Validate key format
      if (!this.validateKeyFormat(encryptionKey)) {
        throw new Error('Invalid encryption key format');
      }

      if (encryptedPayload.length < this.IV_SIZE * 2) {
        throw new Error('Encrypted payload too short');
      }

      console.log(`Decrypting payload (${encryptedPayload.length} chars)`);

      // Extract IV (first 32 hex chars = 16 bytes)
      const ivHex = encryptedPayload.substring(0, this.IV_SIZE * 2);
      const ciphertextHex = encryptedPayload.substring(this.IV_SIZE * 2);

      // Convert hex key and IV to WordArray
      const key = CryptoJS.enc.Hex.parse(encryptionKey);
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      const ciphertext = CryptoJS.enc.Hex.parse(ciphertextHex);

      // Decrypt using AES-CBC
      const decrypted = CryptoJS.AES.decrypt(
        CryptoJS.lib.CipherParams.create({ ciphertext: ciphertext }),
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );

      // Convert to UTF-8 string
      const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);

      // Decompress data (no-op)
      const decompressedData = this.decompressData(decryptedData);

      console.log(`Successfully decrypted (${decompressedData.length} chars)`);
      return decompressedData;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  static generateKey(): string {
    const key = CryptoJS.lib.WordArray.random(this.KEY_SIZE);
    return key.toString(CryptoJS.enc.Hex);
  }
}

export default CryptoUtils;

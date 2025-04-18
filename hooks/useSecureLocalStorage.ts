"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth, encryptData, decryptData  } from '@/contexts/AuthContext';

// These are the types of secrets we'll store
export type SecretType = 'anthropic_api_key' | 'github_api_key';

/**
 * Saves an API key securely to local storage by encrypting it with the provided key
 */
export const saveSecretToStorage = async (
  type: SecretType,
  value: string,
  encryptionKey: CryptoKey
): Promise<void> => {
  try {
    // Encrypt the API key
    const encryptedValue = await encryptData(encryptionKey, value);
    
    // Store it in local storage with a prefix to identify it
    localStorage.setItem(`secure_${type}`, encryptedValue);
    console.log(`[SecureStorage] Saved encrypted ${type}`);
  } catch (error) {
    console.error(`[SecureStorage] Failed to save ${type}:`, error);
    throw new Error(`Failed to securely save ${type}`);
  }
};

/**
 * Retrieves and decrypts an API key from local storage using the provided key
 */
export const getSecretFromStorage = async (
  type: SecretType,
  encryptionKey: CryptoKey
): Promise<string | null> => {
  try {
    // Get the encrypted value from local storage
    const encryptedValue = localStorage.getItem(`secure_${type}`);
    
    // If no value is found, return null
    if (!encryptedValue) {
      console.log(`[SecureStorage] No ${type} found in storage`);
      return null;
    }
    
    // Decrypt and return the value
    const decryptedValue = await decryptData(encryptionKey, encryptedValue);
    console.log(`[SecureStorage] Retrieved and decrypted ${type}`);
    return decryptedValue;
  } catch (error) {
    console.error(`[SecureStorage] Failed to retrieve ${type}:`, error);
    throw new Error(`Failed to decrypt ${type}. The encryption key may be invalid.`);
  }
};

/**
 * Checks if a secret of the given type exists in storage
 */
export const hasSecretInStorage = (type: SecretType): boolean => {
  return localStorage.getItem(`secure_${type}`) !== null;
};

/**
 * Removes a secret from storage
 */
export const removeSecretFromStorage = (type: SecretType): void => {
  localStorage.removeItem(`secure_${type}`);
  console.log(`[SecureStorage] Removed ${type} from storage`);
}; 

/**
 * A hook that provides secure access to encrypted local storage values
 * 
 * @param key The type of secret to store/retrieve
 * @param initialValue Optional default value if no value exists
 * @returns An array containing the decrypted value, a setter function, and loading/error states
 */
export function useSecureLocalStorage<T extends string>(
  key: SecretType,
  initialValue?: T
): [
  T | null, 
  (value: T | null) => Promise<void>,
  boolean,
  Error | null
] {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { encryptionKey } = useAuth();

  // Load the value from storage on mount
  useEffect(() => {
    const loadValue = async () => {
      if (!encryptionKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (hasSecretInStorage(key)) {
          const storedValue = await getSecretFromStorage(key, encryptionKey);
          setValue(storedValue as T);
        } else if (initialValue !== undefined) {
          setValue(initialValue);
        }
      } catch (err) {
        console.error(`Error loading secure value for ${key}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadValue();
  }, [key, initialValue, encryptionKey]);

  // Update the value in storage
  const updateValue = useCallback(
    async (newValue: T | null) => {
      if (!encryptionKey) {
        throw new Error('Encryption key not available');
      }

      try {
        setLoading(true);
        setError(null);

        if (newValue === null) {
          removeSecretFromStorage(key);
          setValue(null);
        } else {
          await saveSecretToStorage(key, newValue, encryptionKey);
          setValue(newValue);
        }
      } catch (err) {
        console.error(`Error saving secure value for ${key}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [key, encryptionKey]
  );

  return [value, updateValue, loading, error];
}

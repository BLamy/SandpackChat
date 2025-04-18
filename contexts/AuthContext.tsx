"use client";
import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { getSecretFromStorage, hasSecretInStorage, saveSecretToStorage } from '../hooks/useSecureLocalStorage';
import { ApiKeyManager } from '../components/ApiKeyManager';

// Extend window interface
declare global {
  interface Window {
    gitFs?: any;
  }
}

export class WebAuthnError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebAuthnError';
  }
}


interface AuthContextType {
  /** Indicates if the user is currently authenticated */
  isAuthenticated: boolean;
  /** The derived cryptographic key for encryption/decryption, null if not authenticated */
  encryptionKey: CryptoKey | null;
  /** A unique identifier derived from the user's passkey, null if not authenticated */
  userIdentifier: string | null;
  /** Any error message related to authentication */
  error: string | null;
  /** Indicates if an authentication operation (login/register) is in progress */
  isLoading: boolean;
  /** Function to initiate the login process */
  login: (apiKey?: string) => Promise<void>;
  /** Function to log the user out */
  logout: () => void;
  /** Function to initiate the registration process */
  // register: (email: string) => Promise<void>;
  /** Function to encrypt data with the user's key */
  encrypt: (data: string) => Promise<string>;
  /** Function to decrypt data with the user's key */
  decrypt: (encryptedData: string) => Promise<string>;
  /** The user's Anthropic API key */
  anthropicApiKey: string | null;
  /** The user's GitHub API key */
  githubApiKey: string | null;
}

// Create the context with an undefined initial value to enforce provider usage
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode | ((context: AuthContextType) => ReactNode);
}

/**
 * Provides authentication state and functions to its children.
 * Manages user login, logout, registration, and the derived encryption key.
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(() => {
    // Initialize from localStorage only on client side
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('userIdentifier');
    }
    return null;
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState<string | null>(null);
  const [githubApiKey, setGithubApiKey] = useState<string | null>(null);

  // // Effect for Auto-Login - trigger immediately if encrypted keys exist
  // useEffect(() => {
  //   // If there are encrypted keys in storage, we should prompt for authentication immediately
  //   if ((hasSecretInStorage('anthropic_api_key') || hasSecretInStorage('github_api_key')) && !encryptionKey && !isLoading) {
  //     console.log("[Auth] Found encrypted keys in storage, initiating authentication...");
  //     setIsLoading(true);
  //     login().catch((err) => {
  //       console.error("[Auth] Auto-login based on stored keys failed:", err);
  //       // Potentially clear userIdentifier if login fails consistently?
  //     }).finally(() => {
  //       // Only set loading false if we didn't successfully get an encryption key
  //       if (!encryptionKey) {
  //         setIsLoading(false);
  //       }
  //     });
  //   } else if (userIdentifier && !encryptionKey && !isLoading) {
  //     // Traditional auto-login flow using stored identifier
  //     console.log("[Auth] Found user identifier, attempting auto-login...");
  //     setIsLoading(true);
  //     login().catch((err) => {
  //       console.error("[Auth] Auto-login based on identifier failed:", err);
  //     }).finally(() => {
  //       if (!encryptionKey) {
  //         setIsLoading(false);
  //       }
  //     });
  //   } else if (!userIdentifier && !hasSecretInStorage('anthropic_api_key') && !hasSecretInStorage('github_api_key')) {
  //     // If no identifier AND no stored keys, ensure encryptionKey is null
  //     setEncryptionKey(null);
  //   }
  //   // Dependency array needs to include encryptionKey and isLoading to avoid stale checks
  // }, [userIdentifier, encryptionKey, isLoading]); // Added encryptionKey and isLoading

  const login = useCallback(async (apiKey?: string) => {
    setError(null);
    setIsLoading(true);
    console.log("[Auth] Initiating login...");
    try {
      const assertion = await startAuthentication();
      console.log('[Auth] Authentication assertion received:', assertion);

      const keyBasisBuffer = base64URLStringToBuffer(assertion.rawId);
      const key = await deriveKey(keyBasisBuffer);
      console.log('[Auth] Encryption key derived.');

      const identifier = assertion.rawId;

      setEncryptionKey(key);
      setUserIdentifier(identifier);
      
      // Only save the API key if it's provided and not empty
      if (apiKey) {
        await saveSecretToStorage('anthropic_api_key', apiKey, key);
        setAnthropicApiKey(apiKey);
        console.log('[Auth] Anthropic API key saved during login');
      } else {
        // If we have a stored key, load it
        if (hasSecretInStorage('anthropic_api_key')) {
          try {
            const storedKey = await getSecretFromStorage('anthropic_api_key', key);
            setAnthropicApiKey(storedKey);
            console.log('[Auth] Loaded existing Anthropic API key');
          } catch (err) {
            console.error('[Auth] Failed to load stored Anthropic API key:', err);
          }
        }
      }

      // Check if localStorage is available (client-side only)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('userIdentifier', identifier);
      }
      
      setError(null);
      console.log('[Auth] Login successful. Identifier:', identifier, ' Anthropic Key Loaded:', !!apiKey);

    } catch (err) { 
      console.error("[Auth] Login failed:", err);
      const errorMessage = err instanceof WebAuthnError ? err.message : 'Authentication failed. Please try again.';
      setError(errorMessage);
      // Clear sensitive state on login failure
      setEncryptionKey(null);
      setAnthropicApiKey(null);
      setGithubApiKey(null);
      // Don't necessarily clear userIdentifier here, as the passkey might still exist
      // localStorage.removeItem('userIdentifier'); 
      throw err; // Re-throw for ApiKeyManager or others to handle
    } finally {
      setIsLoading(false); // Ensure loading is set to false
      console.log("[Auth] Login process finished.");
    }
  }, []);

  // const register = useCallback(async (email: string) => {
  //   setError(null);
  //   setIsLoading(true);
  //   console.log("[Auth] Initiating registration for:", email);
  //   try {
  //     // This check might be redundant if registration implies no current key
  //     // if (encryptionKey) { 
  //     //   console.warn("[Auth] User already authenticated. Logout first to register again.");
  //     //   setError("Already logged in. Please logout first.");
  //     //   setIsLoading(false); // Ensure loading state is reset
  //     //   return;
  //     // }

  //     const credential = await startRegistration(email);
  //     console.log('[Auth] Registration credential created:', credential);
      
  //     // Login immediately after registration to derive key and set identifier
  //     await login(); 
  //     console.log('[Auth] Logged in successfully after registration.');

  //   } catch (err) {
  //     console.error("[Auth] Registration failed:", err);
  //     const errorMessage = err instanceof WebAuthnError ? err.message : 'Registration failed. Please try again.';
  //     setError(errorMessage);
  //     // Clear state on registration failure
  //     setEncryptionKey(null);
  //     setUserIdentifier(null); // Clear identifier as registration failed
  //     setAnthropicApiKey(null);
  //     setGithubApiKey(null);
  //     localStorage.removeItem('userIdentifier');
  //   } finally {
  //     setIsLoading(false);
  //     console.log("[Auth] Registration process finished.");
  //   }
  // }, [login]); // encryptionKey removed as dependency

  const logout = useCallback(() => {
    // debugger;
    console.log("[Auth] Logging out...");
    setEncryptionKey(null);
    setUserIdentifier(null);
    setAnthropicApiKey(null);
    setGithubApiKey(null);
    
    // Check if localStorage is available (client-side only)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('userIdentifier');
    }
    
    setError(null);
    setIsLoading(false); // Ensure loading is false
    console.log("[Auth] User logged out.");
  }, []);

  // Add encryption and decryption functions to the context
  const encrypt = useCallback(async (data: string): Promise<string> => {
    if (!encryptionKey) {
      throw new Error("Cannot encrypt: No encryption key available. Please login first.");
    }
    return encryptData(encryptionKey, data);
  }, [encryptionKey]);

  const decrypt = useCallback(async (encryptedData: string): Promise<string> => {
    if (!encryptionKey) {
      throw new Error("Cannot decrypt: No encryption key available. Please login first.");
    }
    return decryptData(encryptionKey, encryptedData);
  }, [encryptionKey]);

  const contextValue: AuthContextType = {
    isAuthenticated: encryptionKey !== null,
    encryptionKey,
    userIdentifier: userIdentifier!, // Keep assertion or handle potential null
    error,
    isLoading,
    login,
    logout,
    // register,
    encrypt,
    decrypt,
    anthropicApiKey,
    githubApiKey,
  };

  // Render children with context
  // The ApiKeyManager is now shown ONLY if no encryption key exists
  // and we intend to manage the Anthropic key this way.
  // Consider if ApiKeyManager should handle both key types or be separate.
  return (
    <AuthContext.Provider value={contextValue}>
      {!encryptionKey ? 
        (
          <> 
            {/* Conditionally render ApiKeyManager for Anthropic */} 
            {/* This logic might need refinement based on whether Github key also needs upfront management */} 
            <ApiKeyManager 
              type="anthropic_api_key" 
              title="Anthropic API Key" 
              description="Enter your Anthropic API key to use the application" 
              placeholder="sk-ant-api..." 
              linkUrl="https://console.anthropic.com/settings/keys" 
              linkText="Get your Anthropic API key" 
              onKeyValidated={(key) => { // This validation now primarily sets the *pending* key
                // setAnthropicApiKey(key);
              }}
            />
            {/* Potentially add another ApiKeyManager for GitHub key here if needed */} 
          </>
        )
        : typeof children === 'function' ? children(contextValue) 
        : children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to easily consume authentication context.
 * Throws an error if used outside of an AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


export async function startRegistration(email: string) {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new WebAuthnError('WebAuthn is not supported in this browser');
  }

  // Generate random user ID
  const userId = crypto.getRandomValues(new Uint8Array(16));
  
  // Generate challenge
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Passkey Demo',
      id: window.location.hostname,
    },
    user: {
      id: userId,
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      residentKey: 'required',
    },
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PublicKeyCredential;

    const response = credential.response as AuthenticatorAttestationResponse;
    
    return {
      id: credential.id,
      rawId: bufferToBase64URLString(credential.rawId),
      response: {
        clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
        attestationObject: bufferToBase64URLString(response.attestationObject),
      },
      type: credential.type,
    };
  } catch (error) {
    throw new WebAuthnError(`Failed to create credential: ${error}`);
  }
}

export async function startAuthentication() {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw new WebAuthnError('WebAuthn is not supported in this browser');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    rpId: window.location.hostname,
  };

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    }) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      id: assertion.id,
      rawId: bufferToBase64URLString(assertion.rawId),
      response: {
        authenticatorData: bufferToBase64URLString(response.authenticatorData),
        clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
        signature: bufferToBase64URLString(response.signature),
        userHandle: response.userHandle ? bufferToBase64URLString(response.userHandle) : null,
      },
      type: assertion.type,
    };
  } catch (error) {
    throw new WebAuthnError(`Failed to authenticate: ${error}`);
  }
}

export function bufferToBase64URLString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  
  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }
  
  const base64String = btoa(str);
  
  return base64String
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64URLStringToBuffer(base64URLString: string): ArrayBuffer {
  const base64 = base64URLString
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, '=');
  
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return buffer;
}

export async function deriveKey(input: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    input,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('passkey-demo-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(key: CryptoKey, data: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);

  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );

  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);

  return bufferToBase64URLString(combined.buffer);
}

export async function decryptData(key: CryptoKey, encryptedData: string): Promise<string> {
  const data = base64URLStringToBuffer(encryptedData);
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedData);
} 
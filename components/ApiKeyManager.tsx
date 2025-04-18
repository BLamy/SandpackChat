import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  saveSecretToStorage, 
  getSecretFromStorage, 
  hasSecretInStorage, 
  removeSecretFromStorage,
  SecretType
} from '../hooks/useSecureLocalStorage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Trash, Key, LogIn, Save, XCircle, Loader2, Lock } from 'lucide-react';

interface ApiKeyManagerProps {
  type: SecretType;
  title: string;
  description: string;
  placeholder: string;
  linkUrl?: string;
  linkText?: string;
  onKeyValidated?: (key: string) => void;
}

export function ApiKeyManager({ 
  type, 
  title, 
  description, 
  placeholder,
  linkUrl,
  linkText,
  onKeyValidated
}: ApiKeyManagerProps) {
  const { isAuthenticated, encryptionKey, login } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasEncryptedKey, setHasEncryptedKey] = useState(hasSecretInStorage(type));
  const [pendingApiKey, setPendingApiKey] = useState<string | null>(null);

  // Check if there's an encrypted key in storage on mount
  useEffect(() => {
    setHasEncryptedKey(hasSecretInStorage(type));
  }, [type]);

  // // Save pending API key when user becomes authenticated
  // useEffect(() => {
  //   const savePendingKey = async () => {
  //     if (pendingApiKey && isAuthenticated && encryptionKey) {
  //       setLoading(true);
  //       setError(null);
        
  //       try {
  //         await saveSecretToStorage(type, pendingApiKey, encryptionKey);
  //         setSavedApiKey(pendingApiKey);
  //         setHasEncryptedKey(true);
  //         setSuccess(`${title} saved successfully! It's now encrypted with your passkey.`);
          
  //         if (onKeyValidated) {
  //           onKeyValidated(pendingApiKey);
  //         }
          
  //         // Clear the pending key after successful save
  //         setPendingApiKey(null);
  //         setTimeout(() => setSuccess(null), 3000);
  //       } catch (error) {
  //         console.error(`[ApiKeyManager] Error saving ${type}:`, error);
  //         setError(`Failed to save ${title}`);
  //       } finally {
  //         setLoading(false);
  //       }
  //     }
  //   };
    
  //   savePendingKey();
  // }, [isAuthenticated, encryptionKey, pendingApiKey, type, title, onKeyValidated]);

  // Load saved API key when authenticated
  useEffect(() => {
    const loadSavedKey = async () => {
      if (isAuthenticated && encryptionKey) {
        setLoading(true);
        try {
          if (hasSecretInStorage(type)) {
            const key = await getSecretFromStorage(type, encryptionKey);
            
            // Verify the key format (should start with sk- for Anthropic)
            if (key && type === 'anthropic_api_key' && !key.startsWith('sk-')) {
              setError(`Invalid ${title} format. Keys should start with "sk-"`);
              return;
            }
            
            setSavedApiKey(key);
            console.log(`[ApiKeyManager] Loaded ${type} from secure storage`);
            
            // Call the onKeyValidated callback if it exists
            if (key && onKeyValidated) {
              onKeyValidated(key);
            }
          }
        } catch (error) {
          console.error(`[ApiKeyManager] Error loading ${type}:`, error);
          setError(`Failed to load the saved ${type}. It may have been encrypted with a different passkey.`);
        } finally {
          setLoading(false);
        }
      } else {
        setSavedApiKey(null);
      }
    };

    loadSavedKey();
  }, [isAuthenticated, encryptionKey, type, title, onKeyValidated]);

  // Add this method to validate API keys
  const validateApiKey = (key: string): { isValid: boolean; errorMessage?: string } => {
    if (!key.trim()) {
      return { isValid: false, errorMessage: 'Please enter an API key' };
    }
    
    // Validate Anthropic API key format
    if (type === 'anthropic_api_key' && !key.startsWith('sk-')) {
      return { 
        isValid: false, 
        errorMessage: `Invalid ${title} format. Keys should start with "sk-"` 
      };
    }
    
    return { isValid: true };
  };

  const handleSaveApiKey = async () => {
    const validation = validateApiKey(apiKey);
    if (!validation.isValid) {
      setError(validation.errorMessage || 'Invalid API key');
      return;
    }

    setError(null);
    
    // If not authenticated, store the API key and trigger authentication
    if (!isAuthenticated || !encryptionKey) {
      // Store the API key to be saved after authentication
      setPendingApiKey(apiKey);
      setApiKey(''); // Clear the input field
      
      // Show instructions about the upcoming passkey prompt
      setSuccess('After clicking OK in the passkey prompt, your API key will be encrypted.');
      
      // Trigger authentication flow
      setLoading(true);
      try {
        await login(apiKey);
        // The useEffect will handle saving the key once authenticated
      } catch (error) {
        console.error(`[ApiKeyManager] Authentication error:`, error);
        setError('Authentication failed. Please try again.');
        setPendingApiKey(null); // Clear pending key on auth failure
        setSuccess(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // If already authenticated, proceed with saving directly
    setLoading(true);
    
    try {
      await saveSecretToStorage(type, apiKey, encryptionKey);
      setSavedApiKey(apiKey);
      setHasEncryptedKey(true);
      setSuccess(`${title} saved successfully! It's now encrypted with your passkey.`);
      setApiKey('');
      
      if (onKeyValidated) {
        onKeyValidated(apiKey);
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error(`[ApiKeyManager] Error saving ${type}:`, error);
      setError(`Failed to save ${title}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (!isAuthenticated) {
      setError('You must be logged in to remove an API key');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      removeSecretFromStorage(type);
      setSavedApiKey(null);
      setHasEncryptedKey(false);
      setSuccess(`${title} removed successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error(`[ApiKeyManager] Error removing ${type}:`, error);
      setError(`Failed to remove ${title}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveApiKey();
    }
  };

  const handleLoginClick = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(apiKey);
    } catch (err) {
      console.error('[ApiKeyManager] Login error:', err);
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {hasEncryptedKey && !isAuthenticated ? (
            <>
              <Lock className="h-5 w-5 text-primary" />
              Access Your Encrypted API Key
            </>
          ) : (
            <>
              <Key className="h-5 w-5" />
              {title}
            </>
          )}
        </CardTitle>
        <CardDescription>
          {hasEncryptedKey && !isAuthenticated 
            ? 'Verify your identity to access your encrypted API key' 
            : description}
        </CardDescription>
        {linkUrl && linkText && !hasEncryptedKey && (
          <CardDescription>
            <a 
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {linkText}
            </a>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {hasEncryptedKey && !isAuthenticated ? (
          <div className="space-y-4">
            <div className="p-4 border rounded-md bg-muted/50 flex flex-col items-center justify-center text-center">
              <Lock className="h-10 w-10 text-primary mb-2" />
              <p className="text-sm">
                Your API key is securely encrypted with your passkey.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the same passkey you used to encrypt it.
              </p>
            </div>
            <Button 
              onClick={handleLoginClick}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Unlock with Passkey
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {!isAuthenticated ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${type}-input`}>Enter {title}</Label>
                  <div className="flex">
                    <Input
                      id={`${type}-input`}
                      type={showKey ? "text" : "password"}
                      placeholder={placeholder}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={loading}
                      className="w-full"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowKey(!showKey)}
                      className="ml-2"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {apiKey && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setApiKey('')}
                        className="ml-1"
                        title="Clear input"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleSaveApiKey}
                    disabled={loading || !apiKey.trim()}
                    className="flex-1"
                  >
                    {loading && pendingApiKey ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Please select or create a passkey...
                      </>
                    ) : loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isAuthenticated ? 'Encrypting...' : 'Authenticating...'}
                      </>
                    ) : hasEncryptedKey ? (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Create Passkey & Encrypt
                      </>
                    ) : isAuthenticated ? (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Encrypt with Passkey
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Create Passkey & Encrypt
                      </>
                    )}
                  </Button>
                </div>
                {linkUrl && linkText && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Need an API key?{' '}
                    <a 
                      href={linkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {linkText}
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <>
                {savedApiKey ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Current {title}</Label>
                      <div className="flex">
                        <Input
                          type={showKey ? "text" : "password"}
                          value={savedApiKey}
                          readOnly
                          className="w-full"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowKey(!showKey)}
                          className="ml-2"
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleRemoveApiKey}
                      disabled={loading}
                      className="w-full"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Remove {title}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${type}-input`}>Enter {title}</Label>
                      <div className="flex">
                        <Input
                          id={`${type}-input`}
                          type={showKey ? "text" : "password"}
                          placeholder={placeholder}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          onKeyDown={handleKeyDown}
                          disabled={loading}
                          className="w-full"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowKey(!showKey)}
                          className="ml-2"
                        >
                          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        {apiKey && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setApiKey('')}
                            className="ml-1"
                            title="Clear input"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={handleSaveApiKey}
                      disabled={loading || !apiKey.trim()}
                      className="w-full"
                    >
                      {loading && pendingApiKey ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Please select or create a passkey...
                        </>
                      ) : loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isAuthenticated ? 'Encrypting...' : 'Authenticating...'}
                        </>
                      ) : hasEncryptedKey ? (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Create Passkey & Encrypt
                        </>
                      ) : isAuthenticated ? (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Encrypt with Passkey
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          Create Passkey & Encrypt
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mt-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
} 
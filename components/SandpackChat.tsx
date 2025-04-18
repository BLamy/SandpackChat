"use client";

import { useEffect, useState } from "react";
import App from "@/components/App";
import { SandpackProvider } from "@codesandbox/sandpack-react";
import { SandpackLogLevel } from "@codesandbox/sandpack-client";
import { useQueryState } from "nuqs";
import * as LightningFS from '@isomorphic-git/lightning-fs';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { useAuth } from "@/contexts/AuthContext";
import { saveSecretToStorage, useSecureLocalStorage } from "@/hooks/useSecureLocalStorage";
import { AuthProvider } from "@/contexts/AuthContext";

// Default initial files when no repo is specified
const initialFiles = {
  "/App.js": `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Hello Sandpack</h1>
      <h2>Start editing to see some magic happen!</h2>
      <button 
        onClick={() => setCount(prev => prev + 1)}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '0.25rem',
          cursor: 'pointer'
        }}
      >
        Count: {count}
      </button>
    </div>
  );
}`,
  "/index.js": `import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);`,
  "/styles.css": `body {
  margin: 0;
  padding: 0;
  font-family: system-ui, sans-serif;
}

h1 {
  color: #0070f3;
}`,
  "/components/Button.js": `export default function Button({ children, onClick, style }) {
  return (
    <button 
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        background: '#0070f3',
        color: 'white',
        border: 'none',
        borderRadius: '0.25rem',
        cursor: 'pointer',
        ...style
      }}
    >
      {children}
    </button>
  );
}`,
  "/components/Card.js": `export default function Card({ children, style }) {
  return (
    <div 
      style={{
        padding: '1rem',
        border: '1px solid #eaeaea',
        borderRadius: '0.5rem',
        ...style
      }}
    >
      {children}
    </div>
  );
}`,
  "/utils/helpers.js": `export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}`,
  "/utils/helpers.test.js": `import { formatDate, capitalize } from './helpers';

describe('helpers', () => {
  describe('capitalize', () => {
    it('capitalizes the first letter of a string', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('returns empty string when given empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('does not change already capitalized strings', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });
  });

  describe('formatDate', () => {
    it('formats a date object', () => {
      const date = new Date('2023-01-15');
    });

    it('formats a date string', () => {
    });
  });
});`,
  "/components/Button.test.js": `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from './Button';

describe('Button component', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies custom styles', () => {
    render(<Button style={{ backgroundColor: 'red' }}>Styled Button</Button>);
    const button = screen.getByText('Styled Button');
    expect(button).toHaveStyle({ backgroundColor: 'red' });
  });
});`,
  "/package.json": `{
  "name": "sandpack-project",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "jest",
    "test:watch": "jest --watch",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/react": "^14.0.0"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "jest-environment-jsdom": "^29.5.0"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "setupFilesAfterEnv": [
      "./setup-tests.js"
    ]
  }
}`,
  "/jest.config.js": `module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./setup-tests.js'],
  testMatch: ['**/*.{test,spec}.{js,jsx,ts,tsx}']
};`,
  "/setup-tests.js": `import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// Run cleanup after each test case
afterEach(() => {
  cleanup();
});`
};

// Helper function to check if a file is binary (simplified version)
function isBinaryPath(path: string): boolean {
  const binaryExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.ico', '.woff', '.woff2', 
    '.eot', '.ttf', '.otf', '.exe', '.dll', '.so', '.dylib',
    '.zip', '.tar', '.gz', '.rar', '.7z', '.mp3', '.mp4', '.avi'
  ];
  return binaryExtensions.some(ext => path.endsWith(ext));
}

export function SandpackChat() {
  const [repo, setRepo] = useQueryState("repo");
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitFs, setGitFs] = useState<any>(null);
  const [gitInstance, setGitInstance] = useState<any>(null);
  // Track the current repo to detect changes
  const [currentRepoId, setCurrentRepoId] = useState<string | null>(null);
  const { anthropicApiKey, githubApiKey, logout } = useAuth();

  // Initialize the filesystem
  useEffect(() => {
    try {
      // Create a file system instance
      const fs = new LightningFS.default('gitfs');
      setGitFs(fs);
      
      // Make the filesystem available globally
      window.gitFs = fs;
      
      // Initialize git with this filesystem
      setGitInstance(git);
      
      console.log("Git filesystem initialized and attached to window");
    } catch (err: any) {
      console.error("Failed to initialize git filesystem:", err);
      setError("Failed to initialize git system. This browser may not support the required features.");
    }
  }, []);

  // Clone the repository when repo changes
  useEffect(() => {
    // Skip if no repo specified or filesystem not ready
    if (!repo || !gitFs || !gitInstance) return;

    // Skip if we're already on this repo
    if (repo === currentRepoId && Object.keys(files).length > Object.keys(initialFiles).length) {
      return;
    }
    
    const fetchRepo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Parse owner/repo format
        const [owner, repoName] = repo.split("/");
        
        if (!owner || !repoName) {
          throw new Error("Invalid repository format. Use owner/repo");
        }
        
        const dir = '/repo';
        
        // Clear previous repo directory and recreate it
        try {
          // First try to delete any existing files within the directory
          // This is a more thorough cleanup than just rmdir
          const cleanupDirectory = async (path: string) => {
            try {
              const entries = await gitFs.promises.readdir(path);
              
              // Delete all entries inside the directory
              for (const entry of entries) {
                const fullPath = `${path}/${entry}`;
                try {
                  const stat = await gitFs.promises.stat(fullPath);
                  
                  if (stat.isDirectory()) {
                    // Recursively clean up subdirectories
                    await cleanupDirectory(fullPath);
                    await gitFs.promises.rmdir(fullPath);
                  } else {
                    // Delete files
                    await gitFs.promises.unlink(fullPath);
                  }
                } catch (e) {
                  console.warn(`Could not handle ${fullPath}:`, e);
                }
              }
            } catch (e) {
              // Directory might not exist yet
              console.log("Directory doesn't exist or couldn't be read:", e);
            }
          };
          
          // Clean up the repo directory
          await cleanupDirectory(dir);
          
          // Now try to remove the directory itself
          try {
            await gitFs.promises.rmdir(dir);
          } catch (e) {
            console.log("Could not remove directory, may not exist:", e);
          }
          
          // Create a fresh repo directory
          await gitFs.promises.mkdir(dir);
          
        } catch (e) {
          console.warn("Error during directory cleanup:", e);
          
          // Last resort: Reset the entire filesystem
          try {
            await gitFs.reset();
            // Recreate the repo directory after reset
            await gitFs.promises.mkdir(dir);
          } catch (resetErr) {
            console.error("Failed to reset filesystem:", resetErr);
            throw new Error("Could not prepare filesystem for new repository");
          }
        }
        
        // Clone the repository
        console.log(`Cloning ${owner}/${repoName}...`);
        try {
          await gitInstance.clone({
            fs: gitFs,
            http,
            dir,
            url: `https://github.com/${owner}/${repoName}.git`,
            singleBranch: true,
            depth: 1,
            corsProxy: 'https://cors.isomorphic-git.org',
            onAuth: () => ({ username: '', password: '' }),
            force: true, // Force checkout and overwrite any conflicts
          });
          console.log('Clone successful');
        } catch (err: any) {
          console.error('Clone failed:', err);
          throw new Error(`Failed to clone repository: ${err?.message || 'Unknown error'}`);
        }
        
        // Now read the file structure from the cloned repo
        const sandpackFiles: Record<string, string> = {};
        
        // Function to recursively traverse directories
        const traverseDirectory = async (path: string) => {
          const entries = await gitFs.promises.readdir(path);
          
          for (const entry of entries) {
            const fullPath = `${path}/${entry}`;
            const stat = await gitFs.promises.stat(fullPath);
            
            if (stat.isDirectory()) {
              // Skip node_modules and .git
              if (entry !== 'node_modules' && entry !== '.git') {
                await traverseDirectory(fullPath);
              }
            } else if (stat.isFile() && !isBinaryPath(fullPath)) {
              try {
                // Read the file content
                const content = await gitFs.promises.readFile(fullPath, { encoding: 'utf8' });
                
                // Format the path for Sandpack (remove leading /repo)
                const sandpackPath = fullPath.replace('/repo', '');
                sandpackFiles[sandpackPath] = content;
              } catch (error) {
                console.warn(`Could not read file: ${fullPath}`, error);
              }
            }
          }
        };
        
        // Start traversing from the repo root
        await traverseDirectory(dir);
        
        if (Object.keys(sandpackFiles).length === 0) {
          throw new Error("No suitable files found in repository");
        }
        
        setFiles(sandpackFiles);
        setCurrentRepoId(repo); // Update the current repo ID
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching repository:", err);
        setError(err instanceof Error ? err.message : err?.toString() || "Failed to fetch repository");
        setLoading(false);
        // Fall back to default files on error
        setFiles(initialFiles);
        setCurrentRepoId(null);
      }
    };
    
    fetchRepo();
  }, [repo, gitFs, gitInstance, files, currentRepoId]);

  // Display loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Cloning repository {repo}...</p>
        </div>
      </div>
    );
  }

  return (
      <SandpackProvider
        template="react"
        files={files}
        theme="dark"
        options={{
          recompileMode: "immediate",
          initMode: "immediate",
          autorun: true,
          autoReload: true,
          logLevel: SandpackLogLevel.Debug,
          classes: {
            "sp-layout": "!bg-transparent !border-none",
            "sp-stack": "!bg-transparent !border-none",
            "sp-editor": "!bg-background !border-none",
            "sp-preview": "!bg-background !border-none",
            "sp-preview-container": "!bg-background !border-none",
            "sp-preview-iframe": "!bg-white",
            "sp-preview-actions": "!bg-background !border-none",
          },
        }}
      >
        {error && (
          <div className="p-4 mb-4 bg-destructive/10 rounded-lg border border-destructive">
            <h3 className="text-lg font-semibold">Error</h3>
            <p>{error}</p>
          </div>
        )}
        <App repo={repo} setRepo={setRepo} apiKey={anthropicApiKey} setApiKey={() => {}} onRequestApiKey={() => logout()}/>
      </SandpackProvider>
  );
}

export default SandpackChat;
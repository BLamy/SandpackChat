"use client";

import { useState, useEffect, useRef } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackTests,
  useSandpack,
  useActiveCode
} from "@codesandbox/sandpack-react";
import { SandpackAgent } from "@/components/SandpackAgent";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  EyeIcon, 
  MessageCircleIcon, 
  GitBranchIcon, 
  GitCommitIcon,
  Loader2Icon,
  KeyIcon,
  LogOutIcon
} from "lucide-react";
import type { Message } from "@/hooks/useSandpackAgent";
import { useGit } from "@/hooks/useGit";
import { useAuth } from "@/contexts/AuthContext";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AppProps {
  repo: string | null;
  setRepo: (value: string | null) => Promise<URLSearchParams>;
}

// API Key Dialog Component
interface ApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
}

export function ApiKeyDialog({ isOpen, onOpenChange, apiKey, setApiKey }: ApiKeyDialogProps) {
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  
  // Focus API key input when dialog opens
  useEffect(() => {
    if (isOpen && apiKeyInputRef.current) {
      setTimeout(() => {
        apiKeyInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
  const saveApiKey = () => {
    if (apiKey) {
      localStorage.setItem("anthropic-api-key", apiKey);
      onOpenChange(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Anthropic API Key</DialogTitle>
          <DialogDescription>
            Please enter your Anthropic API key to enable AI features.
            Your key will be stored in your browser's local storage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              ref={apiKeyInputRef}
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={saveApiKey} disabled={!apiKey}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add TypeScript declarations for window properties
declare global {
  interface Window {
    changedFilePaths?: Set<string>;
    sandpackFiles?: Record<string, any>;
    markFileAsChanged?: (filePath: string) => void;
    debugSandpack?: () => void;
    gitFs?: any; // Keep gitFs if it's still used globally
  }
}

// Custom code editor with file syncing
function SyncedCodeEditor() {
  const { sandpack } = useSandpack();
  const { files, activeFile } = sandpack;
  const { synchronizeFiles } = useGit();
  
  // Store previous code to detect actual changes
  const [prevCodeMap, setPrevCodeMap] = useState<Record<string, string>>({});

  // Keep track of which files have been changed
  useEffect(() => {
    // Initialize global tracking of changed files if not already present
    if (!window.changedFilePaths) {
      window.changedFilePaths = new Set();
    }
    
    // Initialize sandpackFiles if it doesn't exist
    if (!window.sandpackFiles) {
      window.sandpackFiles = {};
    }
    
    // Store the initial state of all files
    Object.entries(files).forEach(([path, fileData]: [string, any]) => {
      if (fileData && fileData.code && typeof fileData.code === 'string') {
        if (!prevCodeMap[path]) {
          setPrevCodeMap(prev => ({
            ...prev,
            [path]: fileData.code
          }));
        }
        
        // Initialize sandpackFiles with all files
        if (window.sandpackFiles) {
          window.sandpackFiles[path] = fileData.code;
        }
      }
    });
  }, [files, prevCodeMap]);

  // Monitor for code changes in active file
  const { code } = useActiveCode();
  useEffect(() => {
    if (activeFile && code) {
      // Check if code is different from what we have stored
      const previousCode = prevCodeMap[activeFile];
      if (previousCode !== code) {
        // Update our tracking
        setPrevCodeMap(prev => ({
          ...prev,
          [activeFile]: code
        }));
        
        // Mark file as changed
        if (window.changedFilePaths) {
          console.log(`Marking file as changed: ${activeFile}`);
          window.changedFilePaths.add(activeFile);
        }
        
        // Update sandpackFiles
        if (window.sandpackFiles) {
          window.sandpackFiles[activeFile] = code;
        }
        
        console.log(`File content changed in ${activeFile}`);
      }
    }
  }, [activeFile, code, prevCodeMap]);

  // Perform a sync when files change, but debounced to avoid excessive syncs
  useEffect(() => {
    if (!window.changedFilePaths || window.changedFilePaths.size === 0) return;
    
    const debouncedSync = debounce(async () => {
      console.log('Debounced sync triggered for changed files:', window.changedFilePaths ? Array.from(window.changedFilePaths) : []);
      const success = await synchronizeFiles();
      if (success) {
        console.log('Files synchronized successfully');
      }
    }, 1000); // 1 second debounce

    debouncedSync();
    
    return () => {
      debouncedSync.cancel();
    };
  }, [synchronizeFiles, files, activeFile]);

  // Add a method to the window object to mark files as changed
  // This can be used by the AI to mark files it has changed
  useEffect(() => {
    window.markFileAsChanged = (filePath: string) => {
      if (window.changedFilePaths && filePath) {
        console.log(`Marking file as changed (external): ${filePath}`);
        window.changedFilePaths.add(filePath);
        
        // Also update sandpackFiles if we have the file content
        if (window.sandpackFiles && files[filePath] && files[filePath].code) {
          window.sandpackFiles[filePath] = files[filePath].code;
        }
      }
    };
    
    return () => {
      delete window.markFileAsChanged;
    };
  }, [files]);

  return (
    <div className="h-full">
      <SandpackCodeEditor
        showTabs
        showLineNumbers
        showInlineErrors
        wrapContent
        closableTabs
      />
    </div>
  );
}

// Helper debounce function
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  
  const debounced = function(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
  
  debounced.cancel = function() {
    clearTimeout(timeout);
  };
  
  return debounced;
}

export default function App({ repo, setRepo }: AppProps) {
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your coding assistant. How can I help you today?",
      type: "assistant_message",
      timestamp: new Date(),
    },
  ]);
  
  const [repoInput, setRepoInput] = useState(repo || "");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState({ title: "", description: "" });
  const [branchName, setBranchName] = useState("");
  const [prLink, setPrLink] = useState("");
  const [diffOutput, setDiffOutput] = useState("");
  const { sandpack } = useSandpack();
  const { logout, isAuthenticated, anthropicApiKey, githubApiKey } = useAuth();
  const { 
    isLoading, 
    error: gitError, 
    generateDiff, 
    generateCommitMessage, 
    commitChanges, 
    pushChanges,
    createPullRequest,
    createBranch,
    synchronizeFiles
  } = useGit();
  
  // List of files to exclude from diffs and change tracking
  const excludedFiles = ["/App.js", "/index.js", "/.codesandbox/workspace.json"];
  
  
  // Add debug capability to window
  useEffect(() => {
    window.debugSandpack = () => {
      console.group("Sandpack Debug Info");
      console.log("changedFilePaths:", window.changedFilePaths ? Array.from(window.changedFilePaths) : "Not initialized");
      console.log("sandpackFiles:", window.sandpackFiles);
      console.groupEnd();
    };
    
    return () => {
      delete window.debugSandpack;
    };
  }, []);

  useEffect(() => {
    if (repo) {
      console.log("Removing default Sandpack files");
      // Remove default Sandpack files
      if (sandpack.files["/App.js"]) sandpack.deleteFile("/App.js");
      if (sandpack.files["/index.js"]) sandpack.deleteFile("/index.js");
      
      // Clear these files from change tracking if they exist
      if (window.changedFilePaths) {
        excludedFiles.forEach(file => {
          window.changedFilePaths?.delete(file);
        });
      }
    }
  }, [repo, sandpack.files, excludedFiles]);
  
  const handleRepoChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput) {
      await setRepo(repoInput);
    }
  };

  const handleCommitClick = async () => {
    if (!repo) return;
    
    try {
      // Clean any excluded files from change tracking
      if (window.changedFilePaths) {
        excludedFiles.forEach(file => {
          window.changedFilePaths?.delete(file);
        });
      }
      
      // Manual sync - get files from window.sandpackFiles
      console.log("Synchronizing changed files before commit...");
      
      // First try to use our synchronization function
      const syncResult = await synchronizeFiles();
      console.log("Synchronization complete, result:", syncResult);
      
      // If sync failed, try manual sync from SandpackClient
      if (!syncResult && typeof window !== 'undefined') {
        // @ts-ignore
        const sandpackFiles = window.sandpackFiles;
        // @ts-ignore
        const changedFilePaths = window.changedFilePaths;
        
        if (sandpackFiles && changedFilePaths && changedFilePaths.size > 0) {
          console.log("Trying manual sync with changed files:", Array.from(changedFilePaths));
          
          // @ts-ignore
          const fs = window.gitFs;
          if (fs) {
            for (const path of changedFilePaths) {
              if (path && sandpackFiles[path] && typeof sandpackFiles[path] === 'string') {
                const fullPath = `/repo${path.startsWith('/') ? path : `/${path}`}`;
                console.log(`Manual sync: ${fullPath}`);
                
                try {
                  // Make sure the directory exists
                  const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
                  await fs.promises.mkdir(dirPath, { recursive: true }).catch(() => {
                    // Directory might already exist, which is fine
                  });
                  
                  // Write the file
                  await fs.promises.writeFile(fullPath, sandpackFiles[path], 'utf8');
                  console.log(`Successfully manually synced: ${fullPath}`);
                } catch (fileError) {
                  console.error(`Error manually syncing file ${path}:`, fileError);
                }
              }
            }
          }
        } else {
          console.log("No changed files found for manual sync");
        }
      }
      
      console.log("Generating diff...");
      
      // Generate diff
      const diff = await generateDiff();
      console.log("Generated diff:", diff);
      
      // Check if there were any changes
      if (!diff || diff === "No changes detected in the repository.") {
        alert("No changes detected in the repository. Make some changes before committing.");
        return;
      }
      
      setDiffOutput(diff);
      
      // Generate commit message
      const message = await generateCommitMessage(diff);
      setCommitMessage(message);
      
      // Generate branch name based on commit title
      const generatedBranchName = message.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '')       // Remove leading/trailing hyphens
        .substring(0, 50);           // Limit length
      
      setBranchName(generatedBranchName);
      setPrLink("");
      
      // Open dialog
      setIsDialogOpen(true);
    } catch (error) {
      console.error("Error in commit process:", error);
      alert(`Error generating commit: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  const handleCommitAndPush = async () => {
    try {
      if (!repo) return;
      
      // Create a new branch using the hook function
      try {
        await createBranch(branchName);
        console.log(`Successfully created/switched to branch: ${branchName}`);
      } catch (branchError) {
        console.error("Error creating/switching branch:", branchError);
        alert(`Error creating branch: ${branchError instanceof Error ? branchError.message : String(branchError)}`);
        return;
      }
      
      // Create commit
      await commitChanges({
        message: `${commitMessage.title}\n\n${commitMessage.description}`,
        author: {
          name: 'Sandpack User',
          email: 'user@example.com',
        },
      });
      
      // Clear the change tracking after successful commit
      if (typeof window !== 'undefined') {
        // @ts-ignore
        if (window.changedFilePaths) {
          // @ts-ignore
          window.changedFilePaths.clear();
          console.log("Cleared changed files tracking after commit");
        }
      }
      
      // Inform user of successful commit
      alert(`Changes committed successfully to branch '${branchName}' with message: ${commitMessage.title}`);
      
      // Ask if they want to push and create a PR
      const shouldPush = window.confirm("Would you like to push this branch and create a pull request? Note: This will require GitHub authentication.");
      
      if (shouldPush && repo) {
        try {
          // Push changes - note that pushChanges now returns the token
          const token = await pushChanges(repo, branchName);
          
          if (token) {
            // Create a PR
            const prResult = await createPullRequest({
              repoOwnerAndName: repo,
              branch: branchName,
              title: commitMessage.title,
              body: commitMessage.description,
              token
            });
            
            // Set PR link
            setPrLink(prResult.url);
            
            alert(`Pull request #${prResult.number} created successfully! You can view it at ${prResult.url}`);
          } else {
            // If we don't have a token but the push succeeded, create a manual PR link
            const [owner, repoName] = repo.split('/');
            const prUrl = `https://github.com/${owner}/${repoName}/compare/${branchName}?expand=1`;
            setPrLink(prUrl);
            
            alert(`Branch '${branchName}' pushed successfully! You can create a PR manually.`);
          }
        } catch (pushError) {
          console.error("Error during push or PR creation:", pushError);
          alert(`Error: ${pushError instanceof Error ? pushError.message : String(pushError)}`);
          
          // If we failed during PR creation, at least provide a link to create one manually
          if (pushError instanceof Error && pushError.message.includes("Error creating pull request")) {
            const [owner, repoName] = repo.split('/');
            const prUrl = `https://github.com/${owner}/${repoName}/compare/${branchName}?expand=1`;
            setPrLink(prUrl);
          }
        }
      }
    } catch (error) {
      console.error("Error during commit:", error);
      alert(`Error during commit: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Keep dialog open if we have a PR link to show
      if (!prLink) {
        setIsDialogOpen(false);
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground">
      {/* Repo Toolbar */}
      <div className="border-b p-2 flex items-center">
        <div className="flex items-center gap-2 font-medium text-sm mr-4">
          <GitBranchIcon className="h-4 w-4" />
          <span>Repository:</span>
        </div>
        <form onSubmit={handleRepoChange} className="flex-1 flex gap-2">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo"
            className="flex-1 px-2 py-1 text-sm border rounded-md bg-background"
          />
          <button 
            type="submit" 
            className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm font-medium"
          >
            Connect
          </button>
          
          
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => logout()}
              className="px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-sm font-medium flex items-center gap-1 transition-colors"
              title="Log out and clear your API key access"
            >
              <LogOutIcon className="h-3 w-3" />
              <span>Logout</span>
            </button>
          )}
          
          {repo && (
            <button 
              type="button"
              onClick={handleCommitClick}
              disabled={isLoading}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center gap-1"
            >
              {isLoading ? (
                <>
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <GitCommitIcon className="h-3 w-3" />
                  <span>Commit</span>
                </>
              )}
            </button>
          )}
        </form>
        {repo && (
          <div className="ml-4 text-sm text-muted-foreground">
            Connected: <span className="font-medium text-foreground">{repo}</span>
          </div>
        )}
      </div>
      
      {gitError && (
        <div className="p-2 bg-destructive/10 text-destructive text-sm">
          {gitError}
        </div>
      )}
    
      
      {/* Commit Dialog */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Commit Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Review and edit the generated commit message and branch name below
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 my-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Branch Name</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3 py-2 rounded-md border"
                placeholder="feature/my-new-branch"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Commit Title</label>
              <input
                type="text"
                value={commitMessage.title}
                onChange={(e) => setCommitMessage(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Commit Description</label>
              <textarea
                value={commitMessage.description}
                onChange={(e) => setCommitMessage(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border h-32"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Diff Output</label>
              <pre className="text-xs p-3 bg-muted rounded-md overflow-auto max-h-64">
                {diffOutput}
              </pre>
            </div>
            
            {prLink && (
              <div>
                <label className="text-sm font-medium mb-1 block">Pull Request</label>
                <div className="p-3 bg-muted rounded-md">
                  <a 
                    href={prLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Click here to create a pull request for branch '{branchName}'
                  </a>
                </div>
              </div>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCommitAndPush}>
              {prLink ? 'Close' : 'Commit & Push'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={60} minSize={30}>
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              <ResizablePanel defaultSize={30} minSize={15}>
                <SandpackFileExplorer />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize={70}>
                <SyncedCodeEditor />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel with Chat/Preview Tabs */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <Tabs defaultValue="chat" className="h-full flex flex-col w-full">
              <div className="border-b px-4">
                <TabsList>
                  <TabsTrigger value="chat" className="flex items-center gap-2">
                    <MessageCircleIcon className="h-4 w-4" />
                    <span>Chat</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="preview"
                    className="flex items-center gap-2"
                  >
                    <EyeIcon className="h-4 w-4" />
                    <span>Preview</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="flex-1 overflow-hidden">
                <TabsContent
                  value="chat"
                  className="h-full p-0 m-0 data-[state=active]:flex"
                >
                  <SandpackAgent
                    messages={chatMessages}
                    setMessages={setChatMessages}
                    apiKey={anthropicApiKey || ""}
                    onRequestApiKey={() => logout()}
                  />
                </TabsContent>
                <TabsContent
                  value="preview"
                  className="h-full p-0 m-0 data-[state=active]:flex"
                >
                  <SandpackTests />
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

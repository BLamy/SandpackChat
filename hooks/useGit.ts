"use client";

import { useState, useEffect } from 'react';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { useAuth } from '@/contexts/AuthContext';

interface UseGitOptions {
  repoPath?: string;
}

interface CommitOptions {
  message: string;
  author: {
    name: string;
    email: string;
  };
}

interface CommitMessageResult {
  title: string;
  description: string;
}

export function useGit({ repoPath = '/repo' }: UseGitOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { anthropicApiKey } = useAuth();
  const getFileSystem = () => {
    // @ts-ignore
    const fs = window.gitFs;
    if (!fs) {
      throw new Error("Git filesystem not initialized. Make sure you're connected to a repository.");
    }
    return fs;
  };

  // New method to synchronize Sandpack files with the git filesystem
  const synchronizeFiles = async () => {
    try {
      const fs = getFileSystem();
      
      // Get the Sandpack files from the window object
      // @ts-ignore
      const sandpackFiles = window.sandpackFiles;
      // @ts-ignore
      const changedFilePaths = window.changedFilePaths;
      
      if (!sandpackFiles) {
        console.log("No Sandpack files found in window object");
        return false;
      }
      
      if (!changedFilePaths || changedFilePaths.size === 0) {
        console.log("No changed files to sync. If this is unexpected, try editing a file first.");
        return false;
      }
      
      console.log(`Syncing ${changedFilePaths.size} changed files:`, Array.from(changedFilePaths));
      let syncedFilesCount = 0;
      const errors = [];
      
      // Write each changed file to the git filesystem
      for (const path of changedFilePaths) {
        if (!path) continue;
        
        try {
          let content = sandpackFiles[path];
          
          // Handle case where content is an object with code property (from Sandpack format)
          if (content && typeof content === 'object' && content.code && typeof content.code === 'string') {
            content = content.code;
          }
          
          // Skip non-string content or undefined
          if (!content || typeof content !== 'string') {
            console.warn(`Skipping file with invalid content: ${path} (type: ${typeof content})`);
            continue;
          }
          
          // Normalize path
          const normalizedPath = path.startsWith('/') ? path : `/${path}`;
          const fullPath = `${repoPath}${normalizedPath}`;
          
          // Skip special files and directories
          if (
            normalizedPath.includes('node_modules') || 
            normalizedPath.includes('.git/')
          ) {
            console.log(`Skipping special file/directory: ${fullPath}`);
            continue;
          }
          
          console.log(`Syncing changed file: ${fullPath}`);
          
          // Create parent directories if needed
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
          try {
            await fs.promises.mkdir(dirPath, { recursive: true });
          } catch (err) {
            // Directory might already exist, which is fine
            console.debug(`Note: Directory creation for ${dirPath} resulted in: ${err}`);
          }
          
          // Write the file
          await fs.promises.writeFile(fullPath, content, 'utf8');
          syncedFilesCount++;
          console.log(`Successfully synced file: ${fullPath}`);
        } catch (fileError) {
          const errorMsg = `Error syncing file ${path}: ${fileError instanceof Error ? fileError.message : String(fileError)}`;
          console.error(errorMsg);
          errors.push({ path, error: errorMsg });
        }
      }
      
      console.log(`Sync completed: ${syncedFilesCount} files synced successfully, ${errors.length} errors`);
      
      // If we have any errors but also synced some files, we'll consider it a partial success
      if (errors.length > 0) {
        console.warn(`Completed with ${errors.length} errors and ${syncedFilesCount} successful syncs`);
        if (syncedFilesCount === 0) {
          return false; // Complete failure if nothing was synced
        }
      }
      
      return syncedFilesCount > 0;
    } catch (error) {
      const errorMsg = `Error synchronizing files: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      setError(errorMsg);
      return false;
    }
  };

  const getStatusMatrix = async () => {
    try {
      // First synchronize the files
      await synchronizeFiles();
      
      const fs = getFileSystem();
      // Add debug logging
      console.log("Getting status matrix for path:", repoPath);
      const matrix = await git.statusMatrix({ fs, dir: repoPath });
      console.log("Status matrix:", matrix);
      return matrix;
    } catch (error) {
      console.error("Error getting status matrix:", error);
      throw error;
    }
  };

  const generateDiff = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log("Generating diff for path:", repoPath);
      
      // First synchronize files from Sandpack to git filesystem
      const syncResult = await synchronizeFiles();
      console.log("File synchronization result:", syncResult);
      
      // If sync failed completely, don't try to generate a diff
      if (syncResult === false) {
        console.warn("Synchronization failed, cannot generate diff without synchronized files");
        return "No changes detected in the repository. Make sure files are properly synced.";
      }
      
      const fs = getFileSystem();
      const diffOutput: string[] = [];
      
      // Get the status matrix for all files
      const statusMatrix = await git.statusMatrix({ fs, dir: repoPath });
      console.log("Status matrix in generateDiff:", statusMatrix);
      
      let foundChanges = false;
      
      // If the status matrix is empty, try to manually check for changed files
      if (statusMatrix.length === 0 && window.changedFilePaths && window.changedFilePaths.size > 0) {
        console.log("Status matrix is empty but we have changed files in window.changedFilePaths");
        diffOutput.push("# Manual diff from changed files (git status matrix was empty):");
        
        for (const filepath of Array.from(window.changedFilePaths)) {
          try {
            // Get the content from the filesystem
            const fullPath = `${repoPath}${filepath.startsWith('/') ? filepath : `/${filepath}`}`;
            const newContent = await fs.promises.readFile(fullPath, 'utf8');
            
            diffOutput.push(`\n## Changes in ${filepath}:`);
            diffOutput.push(`+++ ${filepath} (new content)`);
            diffOutput.push(newContent);
            foundChanges = true;
          } catch (error) {
            console.error(`Error getting content for ${filepath}:`, error);
          }
        }
        
        if (foundChanges) {
          return diffOutput.join('\n');
        }
      }
      
      // Process each file in the status matrix
      for (const [filepath, head, workdir, stage] of statusMatrix) {
        console.log(`File ${filepath}: head=${head}, workdir=${workdir}, stage=${stage}`);
        
        // Skip unchanged files
        if (head === workdir && head === stage) {
          console.log(`Skipping unchanged file: ${filepath}`);
          continue;
        }
        
        // Double check if the file is actually modified
        const isModified = await checkFileModified(filepath);
        if (!isModified) {
          console.log(`File ${filepath} is not actually modified, skipping`);
          continue;
        }
        
        foundChanges = true;
        let oldContent = '';
        let newContent = '';
        
        // Get old content
        try {
          if (head !== 0) { // File exists in HEAD
            const oldCommit = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
            try {
              const { blob } = await git.readBlob({
                fs,
                dir: repoPath,
                oid: oldCommit,
                filepath
              });
              oldContent = Buffer.from(blob).toString('utf8');
            } catch (e) {
              console.warn(`Could not read old content for ${filepath}:`, e);
            }
          }
        } catch (error) {
          // File might not exist in the old ref
          console.error("Error getting old content:", error);
        }
        
        // Get new content
        try {
          if (workdir !== 0) {
            // Get working directory content
            try {
              newContent = await fs.promises.readFile(`${repoPath}/${filepath}`, 'utf8');
            } catch (e) {
              console.warn(`Could not read new content for ${filepath}:`, e);
            }
          }
        } catch (error) {
          // File might not exist in the new ref
          console.error("Error getting new content:", error);
        }
        
        // Add to diff output
        diffOutput.push(`diff --git a/${filepath} b/${filepath}`);
        if (head === 0) {
          diffOutput.push(`new file mode 100644`);
        } else if (workdir === 0) {
          diffOutput.push(`deleted file mode 100644`);
        }
        diffOutput.push(`--- a/${filepath}`);
        diffOutput.push(`+++ b/${filepath}`);
        
        // Simple line-by-line diff
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        
        if (head === 0) {
          // New file
          newLines.forEach(line => {
            diffOutput.push(`+${line}`);
          });
        } else if (workdir === 0) {
          // Deleted file
          oldLines.forEach(line => {
            diffOutput.push(`-${line}`);
          });
        } else {
          // Modified file - basic line comparison
          const maxLines = Math.max(oldLines.length, newLines.length);
          for (let i = 0; i < maxLines; i++) {
            const oldLine = i < oldLines.length ? oldLines[i] : '';
            const newLine = i < newLines.length ? newLines[i] : '';
            
            if (oldLine !== newLine) {
              if (i < oldLines.length) diffOutput.push(`-${oldLine}`);
              if (i < newLines.length) diffOutput.push(`+${newLine}`);
            } else {
              diffOutput.push(` ${oldLine}`);
            }
          }
        }
      }
      
      if (!foundChanges) {
        console.log("No changes detected in any files");
        return "No changes detected in the repository.";
      }
      
      return diffOutput.join('\n');
    } catch (error) {
      const errorMessage = `Error generating diff: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      return errorMessage;
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateCommitMessage = async (diff: string): Promise<CommitMessageResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const systemPrompt = `You are a helpful assistant that analyzes git diffs and writes good commit messages.
      Given a git diff output, create a short, clear, and informative commit message and description.
      Follow conventional commit format for the title (e.g., feat:, fix:, docs:, style:, refactor:, perf:, test:, build:, ci:, chore:).
      The description should explain what changes were made and why they were necessary, but keep it concise.
      Respond with JSON with 'title' and 'description' properties.`;
      
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey || "",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Here is the diff output:\n\n${diff}\n\nGenerate a conventional commit message title and description based on this diff.`
          }],
          system: systemPrompt,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error generating commit message: ${response.statusText}`);
      }
      
      const data = await response.json();
      let result = { title: "feat: update code", description: "" };
      
      try {
        // Try to parse the content as JSON
        if (data.content && data.content[0] && data.content[0].text) {
          const text = data.content[0].text;
          // Check if the text appears to be JSON
          if (text.includes('"title"') && text.includes('"description"')) {
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}') + 1;
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonString = text.substring(jsonStart, jsonEnd);
              const parsed = JSON.parse(jsonString);
              result = {
                title: parsed.title || result.title,
                description: parsed.description || result.description
              };
            }
          }
        }
      } catch (e) {
        console.error("Error parsing Claude's response:", e);
      }
      
      return result;
    } catch (error) {
      const errorMessage = `Error generating commit message: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      return {
        title: "feat: update code",
        description: "Changes made to the codebase.",
      };
    } finally {
      setIsLoading(false);
    }
  };
  
  const stageChanges = async () => {
    try {
      const fs = getFileSystem();
      const statusMatrix = await git.statusMatrix({ fs, dir: repoPath });
      let hasChanges = false;
      
      for (const [filepath, head, workdir, stage] of statusMatrix) {
        if (head !== workdir || head !== stage) {
          hasChanges = true;
          await git.add({ fs, dir: repoPath, filepath });
        }
      }
      
      if (!hasChanges) {
        throw new Error("No changes detected to stage");
      }
      
      return true;
    } catch (error) {
      const errorMessage = `Error staging changes: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      return false;
    }
  };
  
  const commitChanges = async ({ message, author }: CommitOptions) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const fs = getFileSystem();
      
      // Check if there are changes
      const changesExist = await hasChanges();
      if (!changesExist) {
        throw new Error("No changes detected to commit");
      }
      
      // Stage all changes
      const statusMatrix = await git.statusMatrix({ fs, dir: repoPath });
      for (const [filepath, head, workdir, stage] of statusMatrix) {
        if (head !== workdir || head !== stage) {
          // Verify the change by checking file contents
          const isModified = await checkFileModified(filepath);
          if (isModified) {
            await git.add({ fs, dir: repoPath, filepath });
          }
        }
      }
      
      // Create commit
      const commitResult = await git.commit({
        fs,
        dir: repoPath,
        message,
        author,
      });
      
      return commitResult;
    } catch (error) {
      const errorMessage = `Error during commit: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const pushChanges = async (repoOwnerAndName: string, branch: string = 'main') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const fs = getFileSystem();
      const token = window.prompt("Please enter your GitHub personal access token:");
        
      if (!token) {
        throw new Error("GitHub token is required to push changes");
      }
            
      await git.push({
        fs,
        http,
        dir: repoPath,
        remote: 'origin',
        ref: branch,
        onAuth: () => ({ username: 'token', password: token }),
      });
      
      return token; // Return the token so it can be reused for PR creation
    } catch (error) {
      const errorMessage = `Error pushing changes: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a pull request on GitHub
  const createPullRequest = async (options: {
    repoOwnerAndName: string,
    branch: string,
    title: string,
    body: string,
    token: string
  }) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { repoOwnerAndName, branch, title, body, token } = options;
      const [owner, repo] = repoOwnerAndName.split('/');
      
      // Create the PR using GitHub's REST API
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `token ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title,
          body: body,
          head: branch,
          base: 'main' // Assuming the main branch is 'main'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const prData = await response.json();
      return {
        number: prData.number,
        url: prData.html_url
      };
    } catch (error) {
      const errorMessage = `Error creating pull request: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to create and switch to a branch
  const createBranch = async (branchName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const fs = getFileSystem();
      
      // Get list of branches
      const branches = await git.listBranches({ fs, dir: repoPath });
      console.log("Available branches:", branches);
      
      // Check if branch already exists
      const branchExists = branches.includes(branchName);
      
      if (!branchExists) {
        // Create and checkout the new branch
        await git.branch({ fs, dir: repoPath, ref: branchName });
        console.log(`Created new branch: ${branchName}`);
      }
      
      // Checkout the branch regardless of whether it's new or existing
      await git.checkout({ fs, dir: repoPath, ref: branchName });
      console.log(`Checked out branch: ${branchName}`);
      
      return true;
    } catch (error) {
      const errorMessage = `Error creating/switching branch: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Method to check if a file has been modified in the editor
  const checkFileModified = async (filepath: string) => {
    try {
      const fs = getFileSystem();
      
      // Get the current content in the working directory
      let currentContent = '';
      try {
        currentContent = await fs.promises.readFile(`${repoPath}/${filepath}`, 'utf8');
      } catch (e) {
        console.log(`Could not read current content for ${filepath}, might be deleted`);
        // If we can't read the file in working directory, it might be deleted
        // Check if it exists in HEAD
        try {
          const headCommit = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
          const fileExists = await git.readObject({
            fs,
            dir: repoPath,
            oid: headCommit,
            filepath
          }).catch(() => null);
          
          // If file exists in HEAD but not in working directory, it's deleted
          return fileExists !== null;
        } catch (error) {
          console.log(`Error checking if ${filepath} exists in HEAD:`, error);
          return false;
        }
      }
      
      // Try to get the original content from the HEAD commit
      try {
        const headCommit = await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
        const { blob } = await git.readBlob({
          fs,
          dir: repoPath,
          oid: headCommit,
          filepath
        }).catch(() => ({ blob: null }));
        
        // If blob is null, the file doesn't exist in HEAD - it's a new file
        if (blob === null) {
          console.log(`File ${filepath} is new (does not exist in HEAD)`);
          return true;
        }
        
        const originalContent = Buffer.from(blob).toString('utf8');
        
        // Compare contents with exact string comparison
        const isChanged = currentContent !== originalContent;
        console.log(`File ${filepath} changed: ${isChanged}`);
        return isChanged;
      } catch (error) {
        // If we can't get the file from HEAD, it might be a new file
        console.log(`Could not get original content for ${filepath}, treating as new file:`, error);
        return true;
      }
    } catch (error) {
      console.error(`Error checking if file ${filepath} is modified:`, error);
      return false;
    }
  };
  
  const hasChanges = async () => {
    try {
      const fs = getFileSystem();
      
      // Get the status matrix
      const statusMatrix = await git.statusMatrix({ fs, dir: repoPath });
      console.log("Status matrix in hasChanges:", statusMatrix);
      
      // Check if any file has changes
      for (const [filepath, head, workdir, stage] of statusMatrix) {
        if (head !== workdir || head !== stage) {
          // Verify the change by checking file contents
          const isModified = await checkFileModified(filepath);
          if (isModified) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error checking for changes:", error);
      return false;
    }
  };
  
  return {
    isLoading,
    error,
    generateDiff,
    generateCommitMessage,
    stageChanges,
    commitChanges,
    pushChanges,
    createPullRequest,
    createBranch,
    getStatusMatrix,
    hasChanges,
    synchronizeFiles
  };
} 
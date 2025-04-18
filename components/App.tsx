"use client";

import { useState } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackTests
} from "@codesandbox/sandpack-react";
import { SandpackAgent } from "@/components/SandpackAgent";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EyeIcon, MessageCircleIcon, GitBranchIcon } from "lucide-react";
import type { Message } from "@/hooks/useSandpackAgent";

interface AppProps {
  repo: string | null;
  setRepo: (value: string | null) => Promise<URLSearchParams>;
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
  
  const handleRepoChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (repoInput) {
      await setRepo(repoInput);
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
        </form>
        {repo && (
          <div className="ml-4 text-sm text-muted-foreground">
            Connected: <span className="font-medium text-foreground">{repo}</span>
          </div>
        )}
      </div>
      
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
                <SandpackCodeEditor
                  showTabs
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                  closableTabs
                  style={{ height: "100%" }}
                />
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

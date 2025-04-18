"use client";

import { useState } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import { SandpackAgent } from "@/components/SandpackAgent";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EyeIcon, MessageCircleIcon } from "lucide-react";
import type { Message } from "@/hooks/useSandpackAgent";

export default function App() {
  // Store chat messages in state to persist across tab changes
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your coding assistant. How can I help you today?",
      type: "assistant_message",
      timestamp: new Date(),
    },
  ]);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground">
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
                  <SandpackPreview
                    showNavigator
                    showRefreshButton
                    showRestartButton
                    showSandpackErrorOverlay
                    showOpenInCodeSandbox={false}
                    style={{ height: "100%", width: "100%" }}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

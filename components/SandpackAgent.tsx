"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  SendIcon,
  BotIcon,
  UserIcon,
  KeyIcon,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  useSandpackAgent,
  Message,
  AnthropicMessage,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOLS,
  UserTextMessage,
  AssistantTextMessage,
  ToolCallMessage,
  ToolResultMessage,
  ToolCall,
  ToolResult
} from "@/hooks/useSandpackAgent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface SandpackAgentProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function SandpackAgent({ messages, setMessages }: SandpackAgentProps) {

  const [input, setInput] = useState("");
  const [apiKey, setApiKey] = useState<string>("");
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [collapsedTools, setCollapsedTools] = useState<Record<string, boolean>>(
    {}
  );
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKeyInputRef = useRef<HTMLInputElement>(null);

  // Define the callLLM function that will be passed to useSandpackAgent
  const callLLM = useCallback(
    async (
      messages: AnthropicMessage[],
      systemPrompt: string,
      tools: any[]
    ) => {
      if (!apiKey) {
        throw new Error("API key is required");
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 4000,
          messages: messages,
          system: systemPrompt,
          tools: tools,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || "Failed to get response from Anthropic"
        );
      }

      return await response.json();
    },
    [apiKey]
  );

  // Get the agent hook with our custom callLLM function
  const {
    messages: agentMessages,
    sendMessage,
    clearMessages: clearAgentMessages,
    isLoading,
  } = useSandpackAgent({
    callLLM: callLLM,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    tools: DEFAULT_TOOLS,
  });

  // Check for API key in localStorage on mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem("anthropic-api-key");
    if (storedApiKey) {
      setApiKey(storedApiKey);
    } else {
      setIsApiKeyDialogOpen(true);
    }
  }, []);

  // Sync agent messages with the Chat component's messages
  useEffect(() => {
    if (agentMessages.length > 0) {
      setMessages(agentMessages);
    }
  }, [agentMessages, setMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Focus API key input when dialog opens
  useEffect(() => {
    if (isApiKeyDialogOpen && apiKeyInputRef.current) {
      setTimeout(() => {
        apiKeyInputRef.current?.focus();
      }, 100);
    }
  }, [isApiKeyDialogOpen]);

  const saveApiKey = () => {
    if (apiKey) {
      localStorage.setItem("anthropic-api-key", apiKey);
      setIsApiKeyDialogOpen(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!apiKey) {
      setIsApiKeyDialogOpen(true);
      return;
    }

    setInput("");

    try {
      await sendMessage(input);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleToolCollapse = (messageId: string) => {
    setCollapsedTools((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Clear messages function
  const handleClearMessages = () => {
    clearAgentMessages();
    setMessages([
      {
        id: "1",
        type: "assistant_message",
        content: "Hello! I'm your coding assistant. How can I help you today?",
        timestamp: new Date(),
      },
    ]);
  };

  // Group messages to pair tool calls with their results
  const getGroupedMessages = useCallback(() => {
    const groupedMessages: Array<Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }> = [];
    const toolResultsById: Record<string, ToolResultMessage> = {};
    
    // First, identify all tool results and index them by their toolCallId
    messages.forEach(msg => {
      if (msg.type === 'tool_result') {
        toolResultsById[msg.toolCallId] = msg;
      }
    });
    
    // Now, process all messages and pair tool calls with their results
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (message.type === 'tool_call') {
        const result = toolResultsById[message.toolCall.id];
        
        if (result) {
          // Skip adding the result separately since we're pairing it
          groupedMessages.push({ 
            type: 'tool_pair', 
            call: message,
            result: result
          });
        } else {
          // No result found, just add the tool call
          groupedMessages.push(message);
        }
      } else if (message.type === 'tool_result') {
        // Only add result if it wasn't already paired with a call
        const alreadyPaired = groupedMessages.some(
          m => m.type === 'tool_pair' && 'result' in m && m.result.id === message.id
        );
        
        if (!alreadyPaired) {
          groupedMessages.push(message);
        }
      } else {
        // Regular message, add as is
        groupedMessages.push(message);
      }
    }
    
    return groupedMessages;
  }, [messages]);

  // Render tool call and result as a single card
  const renderToolCard = (toolCall: ToolCall, toolResult?: ToolResult) => {
    const isCollapsed = collapsedTools[toolCall.id] || false;
    const { name, arguments: args } = toolCall;

    // Format tool name for display
    const formatToolName = (name: string) => {
      return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    // Get file path for display
    const getFilePath = () => {
      if (
        name === "edit_file" ||
        name === "create_file" ||
        name === "delete_file"
      ) {
        return args.file_path;
      }
      return null;
    };

    // Get content for code block
    const getCodeContent = () => {
      if (name === "edit_file" || name === "create_file") {
        return args.content || "";
      }
      return JSON.stringify(args, null, 2);
    };

    // Get old content for diff view
    const getOldContent = () => {
      if (name === "edit_file" && toolResult?.oldContent) {
        return toolResult.oldContent;
      }
      return null;
    };

    const filePath = getFilePath();
    const codeContent = getCodeContent();
    const oldContent = getOldContent();

    return (
      <Card className="mt-2 overflow-hidden border shadow-sm">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">
                {formatToolName(name)}{" "}
                {filePath && (
                  <span className="text-muted-foreground ml-1">
                    ({filePath})
                  </span>
                )}
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => toggleToolCollapse(toolCall.id)}
            >
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="p-0">
            {name === "edit_file" || name === "create_file" ? (
              <div className="overflow-x-auto bg-muted/50 p-3">
                {name === "edit_file" && oldContent && (
                  <div className="mt-2 border-t pt-2">
                    <div className="text-xs font-medium mb-1">Changes:</div>
                    <div className="text-xs font-mono">
                      {codeContent
                        .split("\n")
                        .map((line: string, i: number) => {
                          const oldLines = oldContent.split("\n");
                          const oldLine = oldLines[i] || "";
                          if (line === oldLine) {
                            return (
                              <div key={i} className="text-muted-foreground">
                                {line}
                              </div>
                            );
                          } else if (!oldLine) {
                            return (
                              <div
                                key={i}
                                className="bg-green-500/10 text-green-600 dark:text-green-400"
                              >
                                + {line}
                              </div>
                            );
                          } else if (!line) {
                            return (
                              <div
                                key={i}
                                className="bg-red-500/10 text-red-600 dark:text-red-400"
                              >
                                - {oldLine}
                              </div>
                            );
                          } else {
                            return (
                              <div key={i}>
                                <div className="bg-red-500/10 text-red-600 dark:text-red-400">
                                  - {oldLine}
                                </div>
                                <div className="bg-green-500/10 text-green-600 dark:text-green-400">
                                  + {line}
                                </div>
                              </div>
                            );
                          }
                        })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-muted/50">
                <pre className="text-sm font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}

            {toolResult && (
              <div className="p-3 border-t bg-muted/30">
                <div className="text-xs font-medium mb-1">Result:</div>
                <div className="text-sm">
                  {toolResult.status === "success" ? (
                    <span className="text-green-600 dark:text-green-400">
                      {toolResult.message}
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      {toolResult.error || "An error occurred"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  // Render message content based on message type
  const renderMessageContent = (message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }) => {
    if (message.type === 'user_message' || message.type === 'assistant_message') {
      return (
        <div className="text-sm whitespace-pre-wrap break-words overflow-hidden message-content">
          {message.content}
        </div>
      );
    } else if (message.type === 'tool_pair') {
      return renderToolCard(message.call.toolCall, message.result.result);
    } else if (message.type === 'tool_call') {
      return renderToolCard(message.toolCall);
    } else if (message.type === 'tool_result') {
      // This should usually not be rendered separately, but as a fallback
      return (
        <div className="p-3 bg-muted/30 rounded-md mt-2">
          <div className="text-xs font-medium mb-1">Tool Result:</div>
          <div className="text-sm">
            {message.result.status === "success" ? (
              <span className="text-green-600 dark:text-green-400">
                {message.result.message || JSON.stringify(message.result)}
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                {message.result.error || "An error occurred"}
              </span>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  // Determine if a message is from the user
  const isUserMessage = (message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }) => {
    return message.type === 'user_message';
  };

  // Determine if a message is from the assistant
  const isAssistantMessage = (message: Message | { type: 'tool_pair', call: ToolCallMessage, result: ToolResultMessage }) => {
    return message.type === 'assistant_message' || message.type === 'tool_call' || 
      message.type === 'tool_result' || message.type === 'tool_pair';
  };

  const groupedMessages = getGroupedMessages();

  return (
    <>
      <div className="h-full flex flex-col w-full">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold">Chat Assistant</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsApiKeyDialogOpen(true)}
              className="flex items-center gap-1"
            >
              <KeyIcon className="h-3 w-3" />
              API Key
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearMessages}
            >
              Clear
            </Button>
          </div>
        </div>

        <div
          className="flex-1 p-4 overflow-y-auto"
          style={{ height: "calc(100% - 120px)" }}
          ref={scrollAreaRef}
        >
          <div className="flex flex-col gap-4 max-w-full">
            {groupedMessages.map((message, index) => (
              <div
                key={message.type === 'tool_pair' ? `pair-${message.call.id}-${message.result.id}` : message.id}
                className={`flex gap-3 ${
                  isUserMessage(message) ? "justify-end" : "justify-start"
                }`}
              >
                {isAssistantMessage(message) && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback>
                      <BotIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`max-w-[80%] rounded-lg p-3 overflow-hidden ${
                    isUserMessage(message)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {renderMessageContent(message)}

                  <div className="text-xs mt-1 opacity-70 text-right">
                    {formatTime(message.type === 'tool_pair' ? message.call.timestamp : message.timestamp)}
                  </div>
                </div>

                {isUserMessage(message) && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback>
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback>
                    <BotIcon className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
                    <div
                      className="h-2 w-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="h-2 w-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 border-t mt-auto">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading}>
              <SendIcon className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      <Dialog open={isApiKeyDialogOpen} onOpenChange={setIsApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Anthropic API Key</DialogTitle>
            <DialogDescription>
              Please enter your Anthropic API key to enable the chat assistant.
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
    </>
  );
}

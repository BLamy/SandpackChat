# Sandpack AI Coding Assistant

This project demonstrates a React-based AI coding assistant that integrates with Sandpack and Claude AI to provide intelligent code assistance directly in the browser.

## Features

- Chat interface with Claude AI integrated
- Ability to edit, create, and delete files in the Sandpack environment
- Secure API key management
- Responsive UI with loading indicators and tool execution feedback
- Flexible LLM integration through a callback approach
- Customizable system prompts and tools

## Hooks

The project includes one main custom hook:

### useSandpackAgent

This hook provides functionality for interacting with Sandpack files and LLMs. It handles message management, tool calls, and provides a higher-level interface for the AI assistant. The hook accepts a callback function for making LLM API calls, making it flexible and adaptable to different LLM providers.

```typescript
import { 
  useSandpackAgent, 
  type CallLLMFunction,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOLS
} from '@/hooks/useSandpackAgent';

// Define your LLM calling function
const callLLM: CallLLMFunction = async (messages, systemPrompt, tools) => {
  // Make API call to your LLM provider
  const response = await fetch('https://api.your-llm-provider.com/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages,
      system: systemPrompt,
      tools,
    }),
  });
  
  return await response.json();
};

// Inside your component
const { 
  messages, 
  sendMessage, 
  clearMessages, 
  isLoading 
} = useSandpackAgent({ 
  callLLM,
  // Optional parameters with defaults:
  systemPrompt: DEFAULT_SYSTEM_PROMPT, // Use the default or provide your own
  tools: DEFAULT_TOOLS,                // Use the default or provide your own
});

// Example usage
await sendMessage('Create a React component that shows a counter');
```

## Example: Using with Anthropic's Claude

```typescript
import { useCallback } from 'react';
import { 
  useSandpackAgent, 
  type AnthropicMessage,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOLS  
} from '@/hooks/useSandpackAgent';

// Inside your component, with apiKey from state or props
const callLLM = useCallback(async (
  messages: AnthropicMessage[],
  systemPrompt: string,
  tools: any[]
) => {
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
    throw new Error(errorData.error?.message || "Failed to get response");
  }

  return await response.json();
}, [apiKey]);

// Use default system prompt and tools
const { messages, sendMessage } = useSandpackAgent({ 
  callLLM,
  // Optionally customize the system prompt or tools
  // systemPrompt: "Your custom system prompt here...",
  // tools: yourCustomTools,
});
```

## Customizing the System Prompt and Tools

You can provide your own system prompt and tools to customize the behavior of the AI assistant:

```typescript
import { useSandpackAgent, DEFAULT_TOOLS } from '@/hooks/useSandpackAgent';

// Custom system prompt
const CUSTOM_SYSTEM_PROMPT = `You are a helpful coding assistant specialized in React development.
Follow the user's instructions carefully and help them write clean, maintainable code.`;

// Custom tools (extending the defaults)
const CUSTOM_TOOLS = [
  ...DEFAULT_TOOLS,
  {
    name: "search_docs",
    description: "Search the documentation for information",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  }
];

// Use custom prompt and tools
const { messages, sendMessage } = useSandpackAgent({
  callLLM,
  systemPrompt: CUSTOM_SYSTEM_PROMPT,
  tools: CUSTOM_TOOLS,
});
```

## Components

### Chat

The Chat component provides the UI for interacting with the AI assistant. It handles API key management, message display, and user input.

```tsx
import { Chat } from '@/components/chat';
import { useState } from 'react';
import { Message } from '@/hooks/useSandpackAgent';

// Inside your component
const [messages, setMessages] = useState<Message[]>([
  {
    id: '1',
    content: 'Hello! How can I help you today?',
    sender: 'assistant',
    timestamp: new Date(),
  },
]);

// In your render function
<Chat messages={messages} setMessages={setMessages} />
```

## Setup

1. Clone the repository
2. Install dependencies with `npm install`
3. Run the development server with `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000)
5. Enter your Anthropic API key when prompted

## Requirements

- Node.js 16+
- An API key for your preferred LLM provider (the example uses Anthropic Claude)

## Security Note

This project uses direct API calls from the browser, which is not recommended for production applications. In a production environment, API calls to LLM providers should be proxied through a backend service to protect your API key. 
import type { Metadata } from 'next'
import './globals.css'
import { SandpackProvider } from '@codesandbox/sandpack-react'
import { SandpackLogLevel } from '@codesandbox/sandpack-client'
export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}
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
  "/package.json": `{
  "name": "sandpack-project",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --env=jsdom",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "^5.0.1"
  }
}`,
}
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
      <SandpackProvider
      template="react"
      files={initialFiles}
      theme="dark"
    

      options={{
        recompileMode: "immediate",
        initMode: 'immediate',
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
                {children}
        </SandpackProvider>
      </body>
    </html>
  )
}

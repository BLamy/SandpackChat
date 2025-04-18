"use client";
import { AuthProvider } from "@/contexts/AuthContext";
import SandpackChat from "@/components/SandpackChat";

export default function Home() {
  return (
    <AuthProvider>
      <SandpackChat />
    </AuthProvider>
  );
}
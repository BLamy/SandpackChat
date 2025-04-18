import dynamic from 'next/dynamic';

// Dynamically import the SandpackChat component with SSR disabled
const SandpackChat = dynamic(() => import('@/components/SandpackChat'), {
  ssr: false, // Disable server-side rendering
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg">Loading code editor...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <SandpackChat />;
}
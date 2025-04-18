import { AuthProvider } from "@/contexts/AuthContext";

export function SandpackChat() {
  const [repo, setRepo] = useQueryState("repo");
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitFs, setGitFs] = useState<any>(null);
  const [gitInstance, setGitInstance] = useState<any>(null);
  const [currentRepoId, setCurrentRepoId] = useState<string | null>(null);

  const { encryptionKey } = useAuth();

  useEffect(() => {
    // ... (encryption logic) ...
  }, [encryptionKey]);

  useEffect(() => {
    // ... (filesystem init) ...
  }, []);

  useEffect(() => {
    // ... (repo fetching logic) ...
  }, [repo, gitFs, gitInstance, files, currentRepoId]);

  if (loading) {
    // ... (loading indicator) ...
  }

  return (
    <AuthProvider>
      <SandpackProvider
        template="react"
        files={files}
        theme="dark"
        options={{
          // ... (sandpack options) ...
        }}
      >
        {error && (
          <div className="p-4 mb-4 bg-destructive/10 rounded-lg border border-destructive">
            <h3 className="text-lg font-semibold">Error</h3>
            <p>{error}</p>
          </div>
        )}
        <App repo={repo} setRepo={setRepo} />
      </SandpackProvider>
    </AuthProvider>
  );
}

export default SandpackChat; 
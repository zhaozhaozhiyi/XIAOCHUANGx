import { useEffect, useRef, useState } from "react";
import { fetchWorkspaceFileIndex } from "@/lib/workspace/adapter";
import {
  workspaceFileFromRelativePath,
  type WorkspaceFileNode,
} from "@/lib/workspace";

export function useProjectFileIndex(
  workspaceProjectId: string | null,
  query: string,
): {
  files: WorkspaceFileNode[];
  loading: boolean;
  error: string | null;
} {
  const [files, setFiles] = useState<WorkspaceFileNode[]>(() =>
    workspaceProjectId ? [] : [],
  );
  const [loading, setLoading] = useState(Boolean(workspaceProjectId));
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    if (!workspaceProjectId) {
      reqRef.current += 1;
      return;
    }

    const reqId = ++reqRef.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetchWorkspaceFileIndex(workspaceProjectId, query)
        .then((paths) => {
          if (reqRef.current !== reqId) return;
          setFiles(paths.map(workspaceFileFromRelativePath));
          setLoading(false);
        })
        .catch((err) => {
          if (reqRef.current !== reqId) return;
          setError(err instanceof Error ? err.message : "加载文件索引失败");
          setFiles([]);
          setLoading(false);
        });
    }, query ? 120 : 0);

    return () => window.clearTimeout(timer);
  }, [workspaceProjectId, query]);

  return { files, loading, error };
}

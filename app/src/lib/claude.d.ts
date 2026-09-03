/** Minimal typing of the claude.ai artifact runtime (`window.claude.use`) and its `mcp` capability. */
export interface McpError { code: string; message: string; server?: string; retryable?: boolean; retryAfterMs?: number; result?: unknown }
export interface CallToolResult { content: unknown[]; payload?: unknown; cache?: { storedAt: number; revalidating: boolean } }
export type WatchEvent = { type: 'data'; result: CallToolResult } | { type: 'error'; error: McpError };
export interface McpNamespace {
  callTool(server: string, tool: string, input?: unknown, options?: { cache?: false | { staleTime?: number; gcTime?: number; refresh?: boolean } }): Promise<CallToolResult>;
  watchTool(server: string, tool: string, input: unknown, handler: (ev: WatchEvent) => void, options?: { cache?: { staleTime?: number; gcTime?: number }; refetchInterval?: number }): () => void;
  invalidate(server?: string, tool?: string, input?: unknown): Promise<void>;
}
declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

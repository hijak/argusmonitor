export function getWorkspaceId(): string | null {
  return localStorage.getItem("argus_workspace_id");
}

export function setWorkspaceId(workspaceId: string) {
  localStorage.setItem("argus_workspace_id", workspaceId);
}

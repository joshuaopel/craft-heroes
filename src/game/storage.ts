export const editorProjectStorageKey = "craft-heroes-editor-project";
export const clientPreviewStorageKey = "craft-heroes-editor-client-preview";
export const clientSaveStoragePrefix = "craft-heroes-client-save:";

export interface ClientPreviewHandoff {
  version: 1;
  source: "editor";
  timestamp: number;
  campaignId: string;
  startLevelId: string;
  content: unknown;
}

export function clientSaveStorageKey(campaignId: string): string {
  return `${clientSaveStoragePrefix}${campaignId}`;
}

import "./styles.css";
import type { CraftHeroesClientApi } from "./client/host";
import { clientPreviewStorageKey, type ClientPreviewHandoff } from "./game/storage";
import { ClientApp } from "./ui/ClientApp";

function readEditorPreviewHandoff(): ClientPreviewHandoff | undefined {
  try {
    const raw = localStorage.getItem(clientPreviewStorageKey);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as ClientPreviewHandoff;
    return parsed?.version === 1 && parsed.source === "editor" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Missing #app root.");
  }

  const host = window.craftHeroesHost;
  const app = new ClientApp(root, {
    showContentLoader: !host || Boolean(host.chooseContent),
    requestContent: host?.chooseContent ? () => host.chooseContent!() : undefined,
    onProgress: host?.saveProgress ? (save) => host.saveProgress!(save) : undefined,
    onPresence: host?.setPresence ? (presence) => host.setPresence!(presence) : undefined,
    onAchievement: host?.unlockAchievement ? (achievementId) => host.unlockAchievement!(achievementId) : undefined
  });

  const clientApi: CraftHeroesClientApi = {
    loadContent: (content) => app.loadContent(content),
    exportSave: () => app.exportSave(),
    restoreSave: (save) => app.restoreSave(save)
  };
  window.craftHeroesClient = clientApi;

  try {
    const search = new URLSearchParams(window.location.search);
    const preview = !host && search.get("preview") === "editor" ? readEditorPreviewHandoff() : undefined;
    const initialContent = preview ? preview.content : await host?.loadInitialContent?.();
    const loaded = preview
      ? app.loadContent(preview.content, {
          startLevelId: search.get("level") || preview.startLevelId,
          clearSave: true,
          titleMessage: "Previewing the latest editor content."
        })
      : initialContent !== undefined && app.loadContent(initialContent);
    if (!loaded) {
      app.start();
    }
    const progress = await host?.loadProgress?.();
    if (progress) {
      app.registerSave(progress);
    }
  } catch (error) {
    console.error("Unable to initialize the desktop host bridge.", error);
    app.start();
  } finally {
    host?.ready?.();
  }
}

void boot();

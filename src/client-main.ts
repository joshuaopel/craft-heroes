import "./styles.css";
import type { CraftHeroesClientApi } from "./client/host";
import { ClientApp } from "./ui/ClientApp";

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
    const initialContent = await host?.loadInitialContent?.();
    const loaded = initialContent !== undefined && app.loadContent(initialContent);
    if (!loaded) {
      app.start();
    }
    const progress = await host?.loadProgress?.();
    if (progress) {
      app.restoreSave(progress);
    }
  } catch (error) {
    console.error("Unable to initialize the desktop host bridge.", error);
    app.start();
  } finally {
    host?.ready?.();
  }
}

void boot();

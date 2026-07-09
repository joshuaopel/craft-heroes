# Desktop Client Integration

`npm run build:client` creates `dist-client/`. An Electron window should load
`dist-client/client.html`.

The game client has no Electron or Steamworks dependency. A context-isolated
preload script may expose `window.craftHeroesHost` with these optional methods:

```ts
interface CraftHeroesHostBridge {
  platform: "electron";
  loadInitialContent?: () => Promise<unknown | unknown[] | undefined>;
  chooseContent?: () => Promise<unknown | unknown[] | undefined>;
  loadProgress?: () => Promise<ClientSaveData | undefined>;
  saveProgress?: (save: ClientSaveData) => Promise<void>;
  setPresence?: (presence: ClientPresence) => Promise<void>;
  unlockAchievement?: (achievementId: string) => Promise<void>;
  ready?: () => void;
}
```

The Electron main process owns filesystem access, save locations, launch
arguments, Steamworks initialization, cloud synchronization, presence, and
achievement calls. The renderer receives plain JSON and returns plain
serializable data.

Recommended Electron security settings:

- `contextIsolation: true`
- `nodeIntegration: false`
- expose only the methods above through `contextBridge`
- validate campaign JSON and IPC arguments in the main process

The renderer also publishes `window.craftHeroesClient` with `loadContent`,
`exportSave`, and `restoreSave` methods for controlled host integration.

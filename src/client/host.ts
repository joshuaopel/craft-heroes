import type { ClientPresence, ClientSaveData } from "../ui/ClientApp";

export interface CraftHeroesHostBridge {
  platform: "electron";
  loadInitialContent?: () => Promise<unknown | unknown[] | undefined>;
  chooseContent?: () => Promise<unknown | unknown[] | undefined>;
  loadProgress?: () => Promise<ClientSaveData | undefined>;
  saveProgress?: (save: ClientSaveData) => Promise<void>;
  setPresence?: (presence: ClientPresence) => Promise<void>;
  unlockAchievement?: (achievementId: string) => Promise<void>;
  ready?: () => void;
}

export interface CraftHeroesClientApi {
  loadContent: (content: unknown | unknown[]) => boolean;
  exportSave: () => ClientSaveData;
  restoreSave: (save: ClientSaveData) => boolean;
}

declare global {
  interface Window {
    craftHeroesHost?: CraftHeroesHostBridge;
    craftHeroesClient?: CraftHeroesClientApi;
  }
}

export {};

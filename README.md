# Craft Heroes

A playable 3D tactics prototype and early production editor branch for Craft Heroes.

Craft Heroes uses voxel terrain, height advantage, line of sight, and modular cube heroes. Each hero has independently rotating head, body/arms, and legs sections. The class face aimed at an action determines the stats used for movement, attack, healing, and defense.

## Development

```powershell
npm install
npm run dev
```

The editor opens at `index.html`. The standalone game client opens at `client.html`.

## Standalone Client

```powershell
npm run build:client
```

This produces `dist-client/`, the renderer payload intended for a future Electron package. The client does not import the editor and exposes a small preload bridge for campaign content, save data, rich presence, and achievements.

See [Desktop client integration](docs/desktop-client.md).

## Editor Foundation

The production branch splits the game into a Vite + TypeScript app with:

- shared level and campaign JSON schemas
- a Three.js voxel board renderer
- editor tools for terrain height, terrain paint, obstacles, unit placement, and erase
- play/editor mode switching
- current-level JSON export/import
- campaign links between levels

Class-section face art lives in `assets/classes/` as one PNG per class and body section.

# Time Tracker VS Code Extension

This extension tracks the time you spend on your current project. It updates a persistent database every minute and displays the tracked time in the status bar.

## Features

-   Runs in the background as soon as VS Code starts
-   Updates tracked time every minute
-   Stores tracked time per project and per day
-   Shows the tracked time in the status bar (bottom left)

## How it works

-   The extension uses VS Code's globalState to store time data.
-   Every minute, it increments the tracked time for the current project.
-   The status bar item updates automatically.

## Development

-   Source: `src/extension.ts`
-   Activation: Immediately on VS Code start (`activationEvents: ["*"]`)

## Build & Run

-   `npm run compile` to build
-   Press `F5` to launch the extension in a new Extension Development Host window.

## License

MIT

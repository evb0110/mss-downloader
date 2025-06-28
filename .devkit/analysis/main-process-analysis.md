# Main Process Analysis

## Overview

The Electron main process, with its entry point at `src/main/main.ts`, serves as the backend for the MSS Downloader application. It manages all core logic, including the download queue, file system operations, network requests, and PDF creation.

## Key Services

-   **`EnhancedDownloadQueue` (`src/main/services/EnhancedDownloadQueue.ts`):** This is the heart of the application's backend. It's a singleton class that manages the entire download queue (`QueueState`).
    -   **State Persistence:** It uses `electron-store` to save the queue state to `queue.json` in the user data directory, ensuring the queue is restored across application sessions.
    -   **Processing Logic:** It handles the sequential or simultaneous processing of queue items, manages their status (`pending`, `downloading`, `completed`, `failed`), and orchestrates the download and PDF creation process.
    -   **Error Handling:** Includes logic for retries, timeouts, and error isolation to prevent a single failed download from corrupting the entire queue.

-   **`EnhancedManuscriptDownloaderService` (`src/main/services/EnhancedManuscriptDownloaderService.ts`):** This service contains the logic for fetching and parsing manuscript information from all supported digital libraries.
    -   **Library-Specific Logic:** It has dedicated `load...Manifest()` methods for each library (e.g., `loadGallicaManifest`, `loadVatlibManifest`).
    -   **Manifest Caching:** Uses `ManifestCache` to cache parsed manuscript data, speeding up re-adding items to the queue.

-   **`LibraryOptimizationService` (`src/main/services/LibraryOptimizationService.ts`):** A static class that provides library-specific performance tuning.
    -   **Configurations:** Defines settings like concurrent download limits, timeout multipliers, and auto-split thresholds for each library to handle their unique server behaviors.

-   **`ConfigService` (`src/main/services/ConfigService.ts`):** Manages global application settings, also persisted via `electron-store`.

## Inter-Process Communication (IPC)

The main process exposes a comprehensive API to the renderer process via `ipcMain.handle` in `main.ts`. This is the primary way the UI interacts with the backend.

**Key IPC Handlers:**

-   `get-supported-libraries`: Fetches the list of supported libraries.
-   `parse-manuscript-url`: Loads the manifest for a given URL.
-   `queue-*`: A suite of handlers for all queue operations (add, remove, start, pause, stop, update, clear).
-   `config-*`: Handlers for getting and setting global application configuration.
-   `clear-all-caches`: Triggers a full cleanup of manifest and image caches.
-   `solve-captcha`: Creates a dedicated browser window to allow users to solve CAPTCHAs for protected libraries.

## Window Management

-   The `createWindow` function in `main.ts` is responsible for creating the `BrowserWindow`.
-   It includes robust logic to detect if the application is running in a headless environment (e.g., during tests) and prevents the window from being shown, ensuring no UI elements appear during automated runs.

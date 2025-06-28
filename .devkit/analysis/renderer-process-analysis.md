# Renderer Process Analysis

## Overview

The renderer process is the frontend of the MSS Downloader application, responsible for the entire user interface and user interactions. It is built using Vue 3, TypeScript, and Vite.

## Core Technologies

-   **Framework:** Vue 3 (Composition API)
-   **Language:** TypeScript
-   **Build Tool:** Vite
-   **Styling:** SCSS, with a component-based structure.

## Entry Point and Structure

-   **Entry Point:** `src/renderer/main.ts`
-   **Root Component:** `src/renderer/App.vue`
-   **Main UI Component:** `src/renderer/components/DownloadQueueManager.vue`. This single, large component manages the entire UI, including the URL input form, the download queue list, and all associated modals and settings panels.

## State Management and Data Flow

The renderer process is primarily a view layer that reflects the state managed by the main process.

-   **Backend Communication:** All interactions with the backend (main process) are handled through the `window.electronAPI` object, which is securely exposed via the preload script (`src/preload/preload.ts`).
-   **Reactive State:** The `DownloadQueueManager.vue` component maintains a reactive `queueState` ref. This state is kept synchronized with the backend by listening to the `queue-state-changed` IPC event.
-   **Event-Driven Updates:** When the `EnhancedDownloadQueue` in the main process modifies the queue, it emits a `stateChanged` event. The `main.ts` file forwards this to the renderer as `queue-state-changed`, and the Vue component updates its local state, causing the UI to re-render automatically.

## Key UI Components and Features

-   **`DownloadQueueManager.vue`:**
    -   **URL Input:** A textarea for bulk-adding manuscript URLs. It includes logic to parse multiple URLs separated by various delimiters.
    -   **Queue Display:** A list of all download items, grouped by parent manuscript. It dynamically displays the status, progress, and controls for each item.
    -   **Grouped Items:** The UI correctly groups auto-split manuscript parts under a single parent item, with a collapsible interface to show/hide the parts.
    -   **Progress Bars:** Features two levels of progress bars: a global queue progress bar showing the status of all items, and individual progress bars for each item/group currently downloading.
    -   **Queue Controls:** Buttons for starting, pausing, stopping, and clearing the queue.
    -   **Item Controls:** Individual controls for each item to edit, pause, resume, restart, or delete.
-   **`Modal.vue`:** A generic modal component used for:
    -   Displaying the list of supported libraries.
    -   Showing confirmation dialogs (e.g., for clearing the queue).
    -   Providing an "Add More Documents" form when the queue is not empty.
-   **`Spoiler.vue`:** A collapsible component used for the "Default Download Settings" section, allowing users to show/hide global settings like the auto-split threshold and concurrent download limits.

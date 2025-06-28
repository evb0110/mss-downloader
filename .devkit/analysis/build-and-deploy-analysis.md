# Build and Deployment Analysis

## Overview

The project uses GitHub Actions for its Continuous Integration and Continuous Deployment (CI/CD) pipeline. The workflow is defined in `.github/workflows/build-and-notify.yml` and is designed to automatically build, release, and notify users about new versions of the MSS Downloader application.

## Workflow Trigger

-   The workflow is triggered on every `push` to the `main` branch.

## Key Jobs and Steps

The workflow is composed of several dependent jobs:

### 1. `check-version`

-   **Purpose:** To determine if a new version has been published. This prevents the workflow from running on every single commit (e.g., for documentation changes).
-   **Mechanism:** It checks out the code, including the previous commit (`fetch-depth: 2`). It then compares the `version` field in the `package.json` of the current commit with that of the previous commit.
-   **Output:** It produces two outputs:
    -   `version-changed`: A boolean (`true` or `false`) that is used to conditionally run the subsequent build jobs.
    -   `version`: The current application version string.

### 2. `build-windows`, `build-linux`, `build-mac`

-   **Condition:** These jobs only run if `needs.check-version.outputs.version-changed == 'true'`.
-   **Purpose:** To build the application for the three major operating systems. They run in parallel to speed up the process.
-   **Steps:**
    1.  **Setup:** Set up Node.js environment.
    2.  **Install:** Run `npm install` to get dependencies.
    3.  **Build:** Run `npm run dist:*` (e.g., `dist:win:x64`, `dist:mac`). This command uses `electron-builder` to create the distributable artifacts (`.exe`, `.dmg`, `.AppImage`).
    4.  **Create GitHub Release:** The `build-windows` job is responsible for creating a single GitHub Release for the new version tag.
    5.  **Upload Assets:** Each build job then uploads its specific artifact to the created GitHub Release. The asset names are standardized for consistency (e.g., `Abba.Ababus.MSS.Downloader.Setup.1.3.48-x64.exe`).

### 3. `notify`

-   **Condition:** This job runs only after all the build jobs have successfully completed.
-   **Purpose:** To send a notification to all subscribers via the Telegram bot.
-   **Steps:**
    1.  **Setup:** Set up Node.js.
    2.  **Install Bot Dependencies:** Runs `npm install` inside the `telegram-bot/` directory.
    3.  **Wait for API:** Includes a `sleep 30` command to wait for the GitHub API to propagate the new release assets, ensuring the bot can find the download links.
    4.  **Send Notification:** Executes the `npm run send-multiplatform-build` script. This script finds the latest builds, generates a changelog, and sends a formatted message with download links to all subscribers. It requires `TELEGRAM_BOT_TOKEN` and `GH_TOKEN` secrets.

## Summary of the Process

1.  A push to `main` with a version change in `package.json` triggers the workflow.
2.  The app is built for Windows, macOS, and Linux in parallel.
3.  A new GitHub Release is created.
4.  The platform-specific installers are uploaded as assets to the release.
5.  The Telegram bot sends a notification to all subscribers with a changelog and links to the new builds on the GitHub Release page.

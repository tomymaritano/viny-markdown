import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
  date?: string;
}

export interface UpdaterState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  progress: number;
  info: UpdateInfo | null;
  error: string | null;
}

let updateAvailable: UpdateInfo | null = null;
let updateInstance: Awaited<ReturnType<typeof check>> | null = null;

export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const update = await check();

    if (update) {
      updateInstance = update;
      updateAvailable = {
        version: update.version,
        currentVersion: update.currentVersion,
        body: update.body ?? undefined,
        date: update.date ?? undefined,
      };
      return updateAvailable;
    }

    return null;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    return null;
  }
}

export async function downloadAndInstall(
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (!updateInstance) {
    console.error('No update available');
    return false;
  }

  try {
    let downloaded = 0;
    let contentLength = 0;

    await updateInstance.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data.contentLength ?? 0;
          console.log(`Download started, size: ${contentLength}`);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          const progress = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
          onProgress?.(progress);
          break;
        case 'Finished':
          console.log('Download finished');
          onProgress?.(100);
          break;
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to download/install update:', error);
    return false;
  }
}

export async function restartApp(): Promise<void> {
  await relaunch();
}

export function getUpdateInfo(): UpdateInfo | null {
  return updateAvailable;
}

export function clearUpdate(): void {
  updateAvailable = null;
  updateInstance = null;
}

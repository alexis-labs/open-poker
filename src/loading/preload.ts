import type { PlayingCard } from '../game/types';
import { cardFacePath, CRITICAL_IMAGE_PATHS, uniqueAssetPaths } from './assetManifest';
import { assetUrl } from './assetPaths';

interface PreloadAsset {
  url: string;
  label: string;
}

export interface PreloadProgress {
  loaded: number;
  total: number;
  label: string;
  failed: number;
}

export interface PreloadResult {
  total: number;
  failed: string[];
}

export interface PreloadOptions {
  cards?: PlayingCard[];
}

const ASSET_TIMEOUT_MS = 15_000;

function buildPreloadAssets(options: PreloadOptions = {}): PreloadAsset[] {
  const paths = uniqueAssetPaths([
    ...CRITICAL_IMAGE_PATHS,
    ...(options.cards ?? []).map(cardFacePath),
  ]);
  return paths.map((path) => ({ url: assetUrl(path), label: path }));
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error(`Timed out loading image: ${url}`)),
      ASSET_TIMEOUT_MS,
    );
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      window.clearTimeout(timeout);
      if (!img.decode) {
        resolve();
        return;
      }
      void img.decode().catch(() => undefined).then(() => resolve());
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
}

export async function preloadGameAssets(
  onProgress?: (progress: PreloadProgress) => void,
  options: PreloadOptions = {},
): Promise<PreloadResult> {
  const assets = buildPreloadAssets(options);
  const total = assets.length;
  const failed: string[] = [];
  let loaded = 0;

  onProgress?.({ loaded, total, label: 'Preparing assets', failed: 0 });

  await Promise.all(assets.map(async (asset) => {
    try {
      await preloadImage(asset.url);
    } catch (error) {
      failed.push(asset.label);
      console.warn(`[preload] ${asset.label}`, error);
    } finally {
      loaded += 1;
      onProgress?.({ loaded, total, label: asset.label, failed: failed.length });
    }
  }));

  return { total, failed };
}

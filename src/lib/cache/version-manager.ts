/**
 * Client-side cache management utilities for library version synchronization.
 * Handles version comparison and cache invalidation across devices.
 */

const VERSION_STORAGE_KEY = "topaz-library-version";
const INDEXED_DB_NAME = "topaz-cache";
const VERSION_STORE_NAME = "library-versions";

/**
 * Storage interface for library versions
 */
interface VersionStorage {
    getUserVersion(): Promise<number | null>;
    setUserVersion(version: number): Promise<void>;
}

/**
 * IndexedDB-based version storage for Service Worker updates
 */
class IndexedDBVersionStorage implements VersionStorage {
    private db: IDBDatabase | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(INDEXED_DB_NAME, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(VERSION_STORE_NAME)) {
                    db.createObjectStore(VERSION_STORE_NAME);
                }
            };
        });
    }

    async getUserVersion(): Promise<number | null> {
        try {
            const db = await this.getDB();
            const transaction = db.transaction([VERSION_STORE_NAME], "readonly");
            const store = transaction.objectStore(VERSION_STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.get("current");
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result || null);
            });
        } catch (error) {
            console.warn("[cache] Failed to get version from IndexedDB:", error);
            return null;
        }
    }

    async setUserVersion(version: number): Promise<void> {
        try {
            const db = await this.getDB();
            const transaction = db.transaction([VERSION_STORE_NAME], "readwrite");
            const store = transaction.objectStore(VERSION_STORE_NAME);

            return new Promise((resolve, reject) => {
                const request = store.put(version, "current");
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.warn("[cache] Failed to set version in IndexedDB:", error);
        }
    }
}

/**
 * LocalStorage-based version storage for React Query cache
 */
class LocalStorageVersionStorage implements VersionStorage {
    async getUserVersion(): Promise<number | null> {
        try {
            const stored = localStorage.getItem(VERSION_STORAGE_KEY);
            return stored ? Number.parseInt(stored, 10) : null;
        } catch (error) {
            console.warn("[cache] Failed to get version from localStorage:", error);
            return null;
        }
    }

    async setUserVersion(version: number): Promise<void> {
        try {
            localStorage.setItem(VERSION_STORAGE_KEY, version.toString());
        } catch (error) {
            console.warn("[cache] Failed to set version in localStorage:", error);
        }
    }
}

export const indexedDBVersionStorage = new IndexedDBVersionStorage();
export const localStorageVersionStorage = new LocalStorageVersionStorage();

/**
 * Compares versions and determines if a refresh is needed
 */
export function shouldRefreshCache(localVersion: number | null, remoteVersion: number | null): boolean {
    if (!(localVersion && remoteVersion)) return true;
    return remoteVersion > localVersion;
}

/**
 * Gets the latest version from service worker (IndexedDB) or fallback to localStorage
 */
export async function getLatestCachedVersion(): Promise<number | null> {
    // Try IndexedDB first (updated by service worker)
    const indexedVersion = await indexedDBVersionStorage.getUserVersion();
    if (indexedVersion !== null) return indexedVersion;

    // Fallback to localStorage
    return await localStorageVersionStorage.getUserVersion();
}

/**
 * Updates both storage locations with the new version
 */
export async function updateCachedVersion(version: number): Promise<void> {
    await Promise.allSettled([
        localStorageVersionStorage.setUserVersion(version),
        indexedDBVersionStorage.setUserVersion(version),
    ]);
}

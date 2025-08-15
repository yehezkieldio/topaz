/// <reference types="serviceworker" />

// Remove the import since we can't use ES modules in service workers
// Instead, we'll implement a simple version of the functionality inline

declare const self: ServiceWorkerGlobalScope;

/**
 * Service Worker for handling push notifications and updating library versions
 * in the background when the app is not active.
 */

const VERSION_STORAGE_KEY = "topaz-library-version";
const INDEXED_DB_NAME = "topaz-cache";
const VERSION_STORE_NAME = "library-versions";

// Simple IndexedDB wrapper for service worker
async function updateVersionInIndexedDB(version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([VERSION_STORE_NAME], "readwrite");
      const store = transaction.objectStore(VERSION_STORE_NAME);
      
      const putRequest = store.put(version, "current");
      putRequest.onerror = () => reject(putRequest.error);
      putRequest.onsuccess = () => resolve();
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(VERSION_STORE_NAME)) {
        db.createObjectStore(VERSION_STORE_NAME);
      }
    };
  });
}

self.addEventListener("install", (_event) => {
  console.log("[sw] Service worker installing");
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[sw] Service worker activating");
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

/**
 * Handle push notifications for library version updates
 */
self.addEventListener("push", (event) => {
  console.log("[sw] Push notification received");
  
  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    
    if (data.type === "library_version_update" && typeof data.version === "number") {
      console.log("[sw] Processing library version update:", data.version);
      
      // Update version in IndexedDB for when the app next opens
      event.waitUntil(
        updateVersionInIndexedDB(data.version)
          .then(() => {
            console.log("[sw] Updated library version in IndexedDB:", data.version);
          })
          .catch((error) => {
            console.error("[sw] Failed to update library version:", error);
          })
      );
      
      // Optionally pre-warm cache by making a lightweight API call
      // This could fetch the latest library data in the background
      // event.waitUntil(prewarmLibraryCache());
    }
  } catch (error) {
    console.error("[sw] Failed to process push notification:", error);
  }
});

/**
 * Handle background sync for when connectivity is restored
 */
self.addEventListener("sync", (event) => {
  console.log("[sw] Background sync triggered");
  
  if (event.tag === "library-version-sync") {
    event.waitUntil(syncLibraryVersion());
  }
});

/**
 * Sync library version when connectivity is restored
 */
async function syncLibraryVersion() {
  try {
    // Make a lightweight API call to get the latest version
    const response = await fetch("/api/trpc/view.getVersion");
    
    if (response.ok) {
      const data = await response.json();
      const version = data.result?.data?.version;
      
      if (typeof version === "number") {
        await updateVersionInIndexedDB(version);
        console.log("[sw] Synced library version:", version);
      }
    }
  } catch (error) {
    console.error("[sw] Failed to sync library version:", error);
  }
}

/**
 * Optional: Pre-warm cache with latest library data
 */
async function _prewarmLibraryCache() {
  try {
    // This could make a call to fetch the latest library data
    // and store it for faster app startup
    console.log("[sw] Pre-warming library cache...");
    
    // Example implementation:
    // const response = await fetch("/api/trpc/progress.all?input=%7B%22limit%22%3A20%7D");
    // if (response.ok) {
    //   // Cache the response for faster app startup
    // }
  } catch (error) {
    console.error("[sw] Failed to pre-warm cache:", error);
  }
}
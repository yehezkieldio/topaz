import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";

let persisterSingleton: Persister;
export const getPersister = () => {
    if (typeof window !== "undefined") {
        persisterSingleton = createAsyncStoragePersister({
            // TODO: Move to IndexedDB, but currently using localStorage will suffice
            storage: window.localStorage,
        });
    }
    return persisterSingleton;
};

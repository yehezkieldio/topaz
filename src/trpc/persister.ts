import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";
import { createStore, del, get, set } from "idb-keyval";
import SuperJSON from "superjson";

const store = createStore("topaz", "cache");

let persisterSingleton: Persister;
export const getPersister = () => {
    if (typeof window !== "undefined") {
        persisterSingleton = createAsyncStoragePersister({
            deserialize: (cachedString) => SuperJSON.parse(cachedString),
            key: "TOPAZ_CACHE",
            serialize: (client) => SuperJSON.stringify(client),
            storage: {
                getItem: (key) => get(key, store),
                removeItem: (key) => del(key, store),
                setItem: (key, value) => set(key, value, store),
            },
        });
    }
    return persisterSingleton;
};

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";
import { createStore, del, get, set } from "idb-keyval";
import SuperJSON from "superjson";

const store = createStore("topaz", "cache");

let persisterSingleton: Persister;
export const getPersister = () => {
    if (typeof window !== "undefined") {
        persisterSingleton = createAsyncStoragePersister({
            key: "TOPAZ_CACHE",
            storage: {
                getItem: (key) => get(key, store),
                setItem: (key, value) => set(key, value, store),
                removeItem: (key) => del(key, store),
            },
            serialize: (client) => SuperJSON.stringify(client),
            deserialize: (cachedString) => SuperJSON.parse(cachedString),
        });
    }
    return persisterSingleton;
};

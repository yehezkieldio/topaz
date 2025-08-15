import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";
import SuperJSON from "superjson";

export const MILLISECONDS_IN_A_SECOND = 1000;
export const SECONDS_IN_A_MINUTE = 60;
export const MILLISECONDS_IN_A_MINUTE = SECONDS_IN_A_MINUTE * MILLISECONDS_IN_A_SECOND;

export const MINUTES_IN_FIVE_MINUTES = 5;
export const MINUTES_IN_THIRTY_MINUTES = 30;

export const FIVE_MINUTES = MINUTES_IN_FIVE_MINUTES * MILLISECONDS_IN_A_MINUTE;
export const THIRTY_MINUTES = MINUTES_IN_THIRTY_MINUTES * MILLISECONDS_IN_A_MINUTE;

export const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                gcTime: FIVE_MINUTES, // 5 minutes
            },
            dehydrate: {
                serializeData: SuperJSON.serialize,
                shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
            },
            hydrate: {
                deserializeData: SuperJSON.deserialize,
            },
        },
    });

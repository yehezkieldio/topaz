import { afterAll } from "vitest";

import { closeDbConnection } from "@/server/db/client";

afterAll(async () => {
  await closeDbConnection();
});

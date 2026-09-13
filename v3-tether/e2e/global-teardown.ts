import { unlink } from "node:fs/promises";

const globalTeardown = async () => {
  await unlink("e2e/.bearer-token").catch(() => null);
};

export default globalTeardown;

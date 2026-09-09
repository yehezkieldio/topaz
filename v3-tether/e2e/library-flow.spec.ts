import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const WORK_TITLE = `E2E Fixture Work ${Date.now()}`;

test.beforeEach(async ({ context }) => {
  const rawToken = await readFile("e2e/.bearer-token", "utf-8");
  const token = rawToken.trim();
  await context.setExtraHTTPHeaders({ authorization: `Bearer ${token}` });
});

test("browse -> filter -> search -> create work -> favorite", async ({
  page,
}) => {
  await test.step("browse the library", async () => {
    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: "No entries found" })
    ).toBeVisible();
  });

  await test.step("create a work as admin", async () => {
    await page.getByRole("button", { name: "Create Work" }).click();
    await expect(
      page.getByRole("heading", { name: "Create work" })
    ).toBeVisible();

    await page.getByLabel("Title", { exact: true }).fill(WORK_TITLE);
    await page.getByLabel("Sort title").fill(WORK_TITLE.toLowerCase());
    await page.getByLabel("Author").fill("E2E Author");
    await page
      .getByLabel("Source URL")
      .fill(`https://archiveofourown.org/works/${Date.now()}`);

    await page.getByLabel("Source platform").click();
    await page.getByRole("option", { name: "Archive of Our Own" }).click();

    await page.getByRole("button", { name: "Create work" }).click();

    await expect(
      page.getByRole("heading", { name: "Create work" })
    ).toBeHidden();
  });

  await test.step("browse shows the new work", async () => {
    // revalidateTag(..., "max") is stale-while-revalidate, not a blocking
    // invalidation (02_stack/03_caching_and_streaming.md) -- the very next
    // request can still serve the pre-mutation cached page while the
    // background revalidation completes, so this polls instead of asserting
    // on the first paint.
    await expect
      .poll(
        async () => {
          await page.reload();
          return page.getByText(WORK_TITLE).count();
        },
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);
  });

  await test.step("search narrows to the new work", async () => {
    await page.getByLabel("Search library").fill(WORK_TITLE);
    await expect(page.getByText(WORK_TITLE)).toBeVisible();
  });

  await test.step("status filter includes the new work's default status", async () => {
    await page.getByRole("button", { name: /All|Plan to read/u }).click();
    await page.getByRole("menuitemradio", { name: "Plan to read" }).click();
    await expect(page.getByText(WORK_TITLE)).toBeVisible();
  });

  await test.step("favorite toggles and persists across reload", async () => {
    const row = page.locator("article", { hasText: WORK_TITLE });
    const favoriteButton = row.getByRole("button", { name: "Favorite" });
    await favoriteButton.click();
    await expect(row.getByRole("button", { name: "Unfavorite" })).toBeVisible();

    await expect
      .poll(
        async () => {
          await page.reload();
          return page
            .locator("article", { hasText: WORK_TITLE })
            .getByRole("button", { name: "Unfavorite" })
            .count();
        },
        { timeout: 20_000 }
      )
      .toBeGreaterThan(0);
  });
});

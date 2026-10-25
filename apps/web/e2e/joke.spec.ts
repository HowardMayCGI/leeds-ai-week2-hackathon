import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const joke = "Why did the bicycle fall over? It was two tired.";

test("the home page joke button loads, announces a joke and supports another request", async ({
  page,
}) => {
  let complete!: () => void;
  const ready = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let requests = 0;
  await page.route("**/api/joke", async (route) => {
    requests++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().postData()).toBeNull();
    expect(route.request().headers().authorization).toBeUndefined();
    await ready;
    await route.fulfill({ json: { joke } });
  });
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Have a laugh" });
  await expect(demo.getByRole("button", { name: "Tell me a joke" })).toBeVisible();
  expect(requests).toBe(0);
  await demo.getByRole("button").click();
  await expect(demo.getByRole("button", { name: "Getting a joke…" })).toBeDisabled();
  await expect(demo.getByRole("status")).toHaveText("Thinking of a joke…");
  complete();
  await expect(demo.getByRole("status")).toHaveText(joke);
  await expect(demo.getByRole("button")).toBeEnabled();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await demo.getByRole("button").click();
  await expect(demo.getByRole("status")).toHaveText(joke);
  expect(requests).toBe(2);
});

for (const failure of ["upstream error", "invalid response", "network error"]) {
  test(`the joke demo allows retry after ${failure}`, async ({ page }) => {
    await page.route("**/api/joke", (route) => {
      if (failure === "network error") return route.abort();
      return route.fulfill(
        failure === "upstream error"
          ? { status: 502, json: { message: "Private upstream error" } }
          : { json: { joke: " " } },
      );
    });
    await page.goto("/");
    const demo = page.getByRole("region", { name: "Have a laugh" });
    await demo.getByRole("button").click();
    await expect(demo.getByRole("status")).toHaveText(
      "We could not get a joke right now. Please try again.",
    );
    await page.route("**/api/joke", (route) => route.fulfill({ json: { joke } }));
    await demo.getByRole("button", { name: "Try again" }).click();
    await expect(demo.getByRole("status")).toHaveText(joke);
  });
}

test("the joke demo is usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/joke", (route) => route.fulfill({ json: { joke } }));
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Have a laugh" });
  await demo.getByRole("button").click();
  await expect(demo.getByRole("status")).toHaveText(joke);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Página de login", () => {
  test("renderiza el formulario y es navegable por teclado", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "A11y Hub" })
    ).toBeVisible();
    await expect(page.getByLabel("Correo")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();

    // El foco llega a los campos con Tab.
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => document.activeElement?.tagName ?? ""
    );
    expect(["A", "BUTTON", "INPUT"]).toContain(focused);
  });

  test("no tiene violaciones automáticas de axe (WCAG 2.x AA)", async ({
    page,
  }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("redirige a login cuando no hay sesión", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/);
    await expect(page.getByRole("heading", { name: "A11y Hub" })).toBeVisible();
  });
});

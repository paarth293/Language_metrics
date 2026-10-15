import { test, expect } from "@playwright/test";

const teacherPortal = process.env.TEACHER_WEB_URL || "http://localhost:3000";
const studentPortal = process.env.STUDENT_WEB_URL || "http://localhost:3002";

for (const [name, url] of [
  ["teacher login", `${teacherPortal}/login/teacher`],
  ["student login on public portal", `${teacherPortal}/login/student`],
  ["student portal login", `${studentPortal}/login`],
]) {
  test(`${name}: shared password field remains usable`, async ({ page }) => {
    await page.goto(url);
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toBeVisible();
    await password.fill("LocalUiCheck123!");
    await expect(password).toHaveAttribute("type", "password");

    const currentUrl = page.url();
    const show = page.getByRole("button", { name: "Show password", exact: true });
    await show.focus();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("LocalUiCheck123!");
    await expect(page).toHaveURL(currentUrl);
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");

    const geometry = await password.evaluate((input) => {
      const bounds = input.getBoundingClientRect();
      const button = input.parentElement!.querySelector("button")!.getBoundingClientRect();
      return {
        inputWidth: bounds.width,
        buttonWidth: button.width,
        rightPadding: parseFloat(getComputedStyle(input).paddingRight),
        buttonInside: button.left >= bounds.left && button.right <= bounds.right + 1,
      };
    });
    expect(geometry.inputWidth).toBeGreaterThan(100);
    expect(geometry.buttonWidth).toBeGreaterThanOrEqual(40);
    expect(geometry.rightPadding).toBeGreaterThanOrEqual(geometry.buttonWidth);
    expect(geometry.buttonInside).toBe(true);
  });
}

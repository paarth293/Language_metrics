import { test, expect } from "@playwright/test";

const teacherPortal = process.env.TEACHER_WEB_URL || "http://localhost:3000";

test.describe("Student Registration - Pre-Registration Email Availability Validation", () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss cookie consent so it never renders or intercepts clicks
    await page.addInitScript(() => {
      localStorage.setItem("lm-cookie-consent", "accepted");
    });
  });

  test("Scenario A: Existing email - availability check blocks registration before API call", async ({
    page,
  }) => {
    let checkEmailCallCount = 0;
    let registerStudentCallCount = 0;
    let sendRegistrationOtpCallCount = 0;

    // Track network requests
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/auth/check-email")) {
        checkEmailCallCount++;
      }
      if (url.includes("/api/auth/register/student")) {
        registerStudentCallCount++;
      }
      if (url.includes("/api/auth/send-registration-otp")) {
        sendRegistrationOtpCallCount++;
      }
    });

    await page.goto(`${teacherPortal}/register/student`);

    // Fill registration form fields
    const nameInput = page.locator("#student-name");
    const emailInput = page.locator("#student-email");
    const passwordInput = page.locator("#student-password");
    const dobInput = page.locator("#student-dob");
    const languageSelect = page.locator("#student-language");

    await nameInput.fill("Thalapathy Test");
    await passwordInput.fill("Priyanshu@1");
    await dobInput.fill("2000-01-01");

    // Select supported language and level
    await languageSelect.selectOption("french");
    const levelSelect = page.locator("#student-level");
    await levelSelect.selectOption({ index: 1 });

    // Enter known existing email from database
    const checkEmailResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/check-email")
    );
    await emailInput.fill("thalapatyr@gmail.com");
    await emailInput.blur();
    await checkEmailResponsePromise;

    // Verify duplicate error message appears beside email field
    const emailError = page.locator("#student-email-error");
    await expect(emailError).toBeVisible({ timeout: 10000 });
    await expect(emailError).toContainText(
      "This email is already registered. Please use another email address or sign in to your existing account."
    );

    // Assert that check-email was invoked
    expect(checkEmailCallCount).toBeGreaterThanOrEqual(1);

    // Attempt to submit the form
    const submitBtn = page.getByRole("button", { name: /create account/i });
    await submitBtn.click();

    // Small wait to ensure any potential improper async calls would have fired
    await page.waitForTimeout(1000);

    // REQUIRED ASSERTION:
    // Registration API endpoint was NEVER called
    expect(registerStudentCallCount).toBe(0);
    expect(sendRegistrationOtpCallCount).toBe(0);

    // Error remains visible
    await expect(emailError).toBeVisible();
  });

  test("Scenario B: Available email - check succeeds and allows proceeding with registration", async ({
    page,
  }) => {
    let checkEmailCallCount = 0;
    let registrationFlowTriggered = 0;

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/auth/check-email")) {
        checkEmailCallCount++;
      }
      if (
        url.includes("/api/auth/register/student") ||
        url.includes("/api/auth/send-registration-otp")
      ) {
        registrationFlowTriggered++;
      }
    });

    // Intercept registration OTP to avoid sending live emails during test
    await page.route("**/api/auth/send-registration-otp", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Verification code sent." }),
      });
    });

    await page.goto(`${teacherPortal}/register/student`);

    await page.locator("#student-name").fill("Unique Student");
    await page.locator("#student-password").fill("Priyanshu@1");
    await page.locator("#student-dob").fill("2001-05-15");

    const languageSelect = page.locator("#student-language");
    await languageSelect.selectOption("german");
    await page.locator("#student-level").selectOption({ index: 1 });

    const uniqueEmail = `test.student.${Date.now()}@example.com`;
    const emailInput = page.locator("#student-email");

    const checkEmailResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/check-email") && resp.status() === 200
    );
    await emailInput.fill(uniqueEmail);
    await emailInput.blur();
    await checkEmailResponsePromise;

    // No duplicate error should exist
    const emailError = page.locator("#student-email-error");
    await expect(emailError).not.toBeVisible();
    expect(checkEmailCallCount).toBeGreaterThanOrEqual(1);

    // Submit form
    const submitBtn = page.getByRole("button", { name: /create account/i });
    await submitBtn.click();

    // Verify registration OTP flow triggered after availability check passed
    await expect.poll(() => registrationFlowTriggered).toBeGreaterThanOrEqual(1);
  });

  test("Scenario C: Email changed during checking - stale response does not mark new email", async ({
    page,
  }) => {
    let slowRequestResolver: (() => void) | null = null;

    // Intercept check-email for first email to delay response
    await page.route("**/api/auth/check-email?email=slow%40example.com*", async (route) => {
      await new Promise<void>((resolve) => {
        slowRequestResolver = resolve;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          available: false,
          code: "EMAIL_ALREADY_EXISTS",
          message: "Stale duplicate message",
        }),
      });
    });

    await page.goto(`${teacherPortal}/register/student`);

    const emailInput = page.locator("#student-email");

    // 1. Enter slow email
    await emailInput.fill("slow@example.com");
    await emailInput.blur();

    // 2. Quickly replace with a different email before slow response arrives
    await emailInput.fill("fresh@example.com");

    // 3. Resolve the stale request now
    if (slowRequestResolver) {
      slowRequestResolver();
    }
    await page.waitForTimeout(500);

    // The stale response for slow@example.com must NOT mark fresh@example.com as unavailable
    const emailError = page.locator("#student-email-error");
    await expect(emailError).not.toBeVisible();
  });

  test("Scenario D: Availability endpoint failure displays recoverable error and blocks submission", async ({
    page,
  }) => {
    let registrationEndpointCalled = false;

    page.on("request", (req) => {
      if (
        req.url().includes("/api/auth/register/student") ||
        req.url().includes("/api/auth/send-registration-otp")
      ) {
        registrationEndpointCalled = true;
      }
    });

    // Mock 500 error for check-email
    await page.route("**/api/auth/check-email*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Server down" }),
      });
    });

    await page.goto(`${teacherPortal}/register/student`);

    await page.locator("#student-name").fill("Failure Test");
    await page.locator("#student-password").fill("Priyanshu@1");
    await page.locator("#student-dob").fill("2000-01-01");
    await page.locator("#student-language").selectOption("german");
    await page.locator("#student-level").selectOption({ index: 1 });

    const emailInput = page.locator("#student-email");
    await emailInput.fill("unreachable@example.com");
    await emailInput.blur();

    // Expect recoverable error message
    const emailError = page.locator("#student-email-error");
    await expect(emailError).toBeVisible({ timeout: 5000 });
    await expect(emailError).toContainText("Unable to verify email availability");

    // Click submit
    const submitBtn = page.getByRole("button", { name: /create account/i });
    await submitBtn.click();
    await page.waitForTimeout(500);

    // Registration API must NOT be called while availability is unknown
    expect(registrationEndpointCalled).toBe(false);
  });
});

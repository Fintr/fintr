import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "tmp-harbor-light");
const USER = {
  id: "f1eafdbd-2da2-4d24-b34a-39d7c43ccbb2",
  email: "harbor.house@example.com",
  name: "Aria Santos",
  sub: "auth0|harbor-house-screenshots",
  spaceCode: "harbor-house-example-com-personal-space",
};

const readAuth0Suffix = () => {
  const text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
  const line = text
    .split("\n")
    .find((entry) => /^\s*NEXT_PUBLIC_AUTH0_DOMAIN\s*=/.test(entry));
  const raw = line
    ?.replace(/^\s*NEXT_PUBLIC_AUTH0_DOMAIN\s*=\s*/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
  return raw?.replace(/\./g, "_") || "default";
};

const buildJwt = () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ sub: USER.sub, email: USER.email, name: USER.name }),
  ).toString("base64url");
  return `${header}.${body}.e2e-signature`;
};

const installAuth = async (context) => {
  const domain = readAuth0Suffix();
  const token = buildJwt();
  await context.addInitScript(
    ({ domain, user, token }) => {
      const mockUser = { sub: user.sub, email: user.email, name: user.name };
      const mockTokens = {
        access_token: token,
        id_token: token,
        refresh_token: "e2e-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid profile email",
      };
      const expiresAt = String(Date.now() + 3_600_000);
      const issuedAt = String(Date.now());
      for (const suffix of [domain, "default"]) {
        localStorage.setItem(`@@auth0@@.access_token.${suffix}`, token);
        localStorage.setItem(`@@auth0@@.id_token.${suffix}`, token);
        localStorage.setItem(`@@auth0@@.refresh_token.${suffix}`, mockTokens.refresh_token);
        localStorage.setItem(`@@auth0@@.expires_at.${suffix}`, expiresAt);
        localStorage.setItem(`@@auth0@@.user.${suffix}`, JSON.stringify(mockUser));
        localStorage.setItem(`@@auth0@@.scope.${suffix}`, mockTokens.scope);
        localStorage.setItem(`@@auth0@@.issued_at.${suffix}`, issuedAt);
      }
      localStorage.setItem("auth_tokens", JSON.stringify(mockTokens));
      localStorage.setItem("fintr_auth_data", JSON.stringify({ tokens: mockTokens, user: mockUser }));
      localStorage.setItem("spaceCode", user.spaceCode);
      localStorage.setItem("fintr-theme", "light");
      const completedAt = new Date().toISOString();
      localStorage.setItem(`fintr:tutorial-completed:${user.sub}:mobile`, completedAt);
      localStorage.setItem(`fintr:tutorial-completed:${user.sub}:desktop`, completedAt);
      localStorage.setItem("fintr_weekly_feedback_v1_lastActionAt", String(Date.now()));
      localStorage.setItem("fintr_weekly_feedback_v1_lastPromptWeekKey", "2026-W39");
      document.documentElement.classList.remove("dark");
    },
    { domain, user: USER, token },
  );

  await context.route("**/fintr.jp.auth0.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: token,
        id_token: token,
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });
  });

  await context.route("**/api/v1/**", async (route) => {
    const headers = { ...route.request().headers() };
    delete headers.authorization;
    headers["x-e2e-test-auth"] = "playwright";
    headers["x-e2e-test-user-id"] = USER.id;
    await route.continue({ headers });
  });
};

const shot = async (page, name) => {
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.querySelectorAll("nextjs-portal, [data-sonner-toaster]").forEach((element) => {
      element.remove();
    });
  }).catch(() => undefined);
  await page.screenshot({ path: path.join(OUT, name), animations: "disabled" });
};

const dismiss = async (page) => {
  const close = page.getByRole("button", { name: "Close" });
  if (await close.isVisible().catch(() => false)) await close.click();
};

const waitForHarbor = async (page) => {
  await page.goto("http://localhost:5173/dashboard/insights", { waitUntil: "domcontentloaded" });
  await page.getByText(/How's Fintr going|Net Income/).first().waitFor({ timeout: 90_000 });
  await dismiss(page);
  const ready = await page.getByText("Strong Saver").waitFor({ timeout: 90_000 }).then(() => true).catch(() => false);
  if (!ready) {
    await page.screenshot({ path: path.join(OUT, "debug.png") });
    throw new Error("Harbor House insights did not load");
  }
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.waitForTimeout(600);
};

const makeReceipt = async (browser) => {
  const page = await browser.newPage({ viewport: { width: 720, height: 1100 }, deviceScaleFactor: 2 });
  await page.setContent(`
    <body style="margin:0;background:#f4f1ea;font-family:ui-monospace,Menlo,monospace;color:#1c1917;">
      <div style="width:640px;margin:40px auto;background:#fff;padding:48px 40px;">
        <div style="text-align:center;letter-spacing:3px;font-size:28px;font-weight:700;">SM SUPERMARKET</div>
        <div style="text-align:center;margin-top:8px;font-size:16px;">Glorietta 4, Makati City</div>
        <div style="text-align:center;margin-top:4px;font-size:16px;">25 Sep 2026  18:42</div>
        <div style="border-top:2px dashed #bbb;margin:28px 0;"></div>
        ${[
          ["Rice 5kg", "285.00"],
          ["Eggs, 12s", "198.00"],
          ["Fresh milk 1L", "168.00"],
          ["Chicken breast", "412.00"],
          ["Mixed vegetables", "327.00"],
          ["Pandesal", "95.00"],
          ["Cooking oil", "189.00"],
          ["Canned tuna", "246.00"],
          ["Yogurt", "156.00"],
          ["Dish soap", "89.00"],
          ["Bananas", "120.00"],
          ["Ground coffee", "195.00"],
        ].map(([name, amount]) => `<div style="display:flex;justify-content:space-between;font-size:22px;margin:10px 0;"><span>${name}</span><span>${amount}</span></div>`).join("")}
        <div style="border-top:2px dashed #bbb;margin:28px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:28px;font-weight:700;"><span>TOTAL</span><span>PHP 2,480.00</span></div>
        <div style="margin-top:18px;font-size:18px;">GCash · Approved</div>
      </div>
    </body>
  `);
  const file = path.join(OUT, "receipt-source.png");
  await page.locator("div").first().screenshot({ path: file });
  await page.close();
  return file;
};

const captureApp = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
  await installAuth(context);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await waitForHarbor(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "insights.png");

  await page.getByText("Expense Breakdown", { exact: true }).evaluate((element) => {
    element.scrollIntoView({ block: "start" });
  });
  await page.evaluate(() => window.scrollBy(0, -24));
  await page.waitForTimeout(500);
  await shot(page, "breakdown.png");

  await page.getByRole("button", { name: "Add Options" }).click();
  await page.getByTestId("mobile-add-transaction").click();
  await page.locator("#amount").waitFor();
  await page.locator("#amount").fill("2640");
  await page.getByPlaceholder("Shown on the transaction list").fill("Manam dinner");
  const splitButton = page.getByRole("button", { name: "Split with people" });
  await splitButton.scrollIntoViewIfNeeded();
  await splitButton.evaluate((button) => button.click());
  await page.waitForTimeout(300);
  if ((await page.getByRole("button", { name: "Create borrower" }).count()) === 0) {
    await splitButton.evaluate((button) => button.click());
  }
  await page.getByRole("button", { name: "Create borrower" }).first().evaluate((button) => button.click());
  await page.locator("#new-entity-name").waitFor();
  await page.locator("#new-entity-name").fill("Leo Cruz");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Leo Cruz").first().waitFor();
  await page.getByRole("button", { name: "Add another person" }).evaluate((button) => button.click());
  await page.getByRole("button", { name: "Create borrower" }).last().evaluate((button) => button.click());
  await page.locator("#new-entity-name").fill("Mina Reyes");
  await page.getByRole("button", { name: "Save" }).last().click();
  await page.getByText("Mina Reyes owes you").waitFor();
  await page.getByText("Borrower name").waitFor({ state: "hidden" });
  await page.getByText(/has been added/).waitFor({ state: "hidden", timeout: 8_000 }).catch(() => undefined);
  await shot(page, "split.png");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add Options" }).click();
  await page.getByRole("button", { name: /Add Receipt/ }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(OUT, "receipt-source.png"));
  await page.getByRole("img", { name: "Receipt preview" }).waitFor();
  await shot(page, "receipt.png");

  await page.keyboard.press("Escape");
  await page.goto("http://localhost:5173/dashboard/insights", { waitUntil: "domcontentloaded" });
  await page.getByText("Strong Saver").waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Add Options" }).click();
  await page.getByRole("button", { name: /Chat with AI/ }).click();
  await page.getByRole("heading", { name: "Fintr AI Assistant" }).waitFor();
  await page.locator("[data-slot='dialog-content'] button").first().click();
  await page.getByText("September spending").click();
  await page.getByText("Rent is still the largest bill").waitFor();
  await page.waitForTimeout(500);
  await shot(page, "chat.png");
  await context.close();
};

const frameShots = async (browser) => {
  const slides = [
    ["3-1.png", "receipt.png", "Snap a Receipt and\nFintr Reads It"],
    ["3-2.png", "split.png", "Split the Bill and\nSee Who Owes You"],
    ["3-3.png", "insights.png", "Understand Your Month\nat a Glance"],
    ["3-4.png", "breakdown.png", "See Where Your Money\nActually Goes"],
    ["3-5.png", "chat.png", "Ask Questions About\nYour Own Money"],
  ];
  const page = await browser.newPage({ viewport: { width: 1242, height: 2688 }, deviceScaleFactor: 1 });
  for (const [file, source, title] of slides) {
    const image = fs.readFileSync(path.join(OUT, source)).toString("base64");
    const heading = title.split("\n").map((line) => `<div>${line}</div>`).join("");
    await page.setContent(`
      <html>
        <head>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@700&display=swap">
          <style>
            html, body { margin: 0; width: 1242px; height: 2688px; background: #0A2540; }
            .wrap { height: 2688px; display: flex; flex-direction: column; align-items: center; padding: 120px 80px 72px; box-sizing: border-box; }
            h1 { margin: 0; color: #F6F1E7; font-family: "League Spartan", sans-serif; font-weight: 700; font-size: 84px; line-height: 0.98; letter-spacing: -1.5px; text-align: center; }
            .phone { margin-top: 72px; width: 920px; flex: 1; background: #07182b; border-radius: 78px; padding: 18px; box-sizing: border-box; display: flex; min-height: 0; }
            .screen { flex: 1; background: #f7f8fa; border-radius: 62px; overflow: hidden; display: flex; flex-direction: column; min-height: 0; position: relative; }
            .status { height: 74px; display: flex; align-items: center; justify-content: space-between; padding: 18px 36px 0; font-family: -apple-system, sans-serif; font-weight: 600; font-size: 28px; color: #0A2540; background: #fff; }
            .island { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); width: 168px; height: 36px; background: #0a0a0a; border-radius: 20px; }
            img { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <h1>${heading}</h1>
            <div class="phone"><div class="screen"><div class="island"></div><div class="status"><span>9:41</span><span>100%</span></div><img src="data:image/png;base64,${image}" /></div></div>
          </div>
        </body>
      </html>
    `);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(ROOT, "public/images/app-screenshots", file) });
  }
  await page.close();
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  await makeReceipt(browser);
  await captureApp(browser);
  await frameShots(browser);
} finally {
  await browser.close();
}

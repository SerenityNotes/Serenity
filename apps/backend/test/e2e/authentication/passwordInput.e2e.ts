import { expect, test } from "@playwright/test";
import { v4 as uuidv4 } from "uuid";
import createUserWithWorkspace from "../../../src/database/testHelpers/createUserWithWorkspace";
import { delayForSeconds } from "../../helpers/delayForSeconds";
import { e2eLoginUser } from "../../helpers/e2e/e2eLoginUser";
import { reloadPage } from "../../helpers/e2e/reloadPage";

test("Bad login then good login", async ({ page }) => {
  const username = `${uuidv4()}@example.com`;
  const password = "pass";
  const { user, workspace, document } = await createUserWithWorkspace({
    id: uuidv4(),
    username,
    password,
  });

  await page.goto("http://localhost:19006/login");
  await e2eLoginUser({ page, username, password, stayLoggedIn: false });
  await delayForSeconds(3);
  await expect(page).toHaveURL(
    `http://localhost:19006/workspace/${workspace.id}/page/${document.id}`
  );
  await reloadPage({ page });
  await delayForSeconds(3);
  await page.locator(`[data-testid=general__account-menu--trigger]`).click();
  await delayForSeconds(1);
  await page
    .locator(`[data-testid=general__account-menu--create-workspace]`)
    .click();
  await delayForSeconds(1);
  const passwordModal = page.locator(`[data-testid=verify-password-modal]`);
  const passwordInput = page.locator(
    `[data-testid=verify-password-modal__password-input]`
  );
  const verifyButton = page.locator(
    `[data-testid=verify-password-modal__submit-button]`
  );
  // enter wrong password. Modal should stay open
  await passwordInput.type("badpass");
  await verifyButton.click();
  await delayForSeconds(2);
  const isModalVisible1 = await passwordModal.isVisible();
  expect(isModalVisible1).toBe(true);
  // enter correct password. Modal should close
  await passwordInput.selectText();
  await passwordInput.type("pass");
  await verifyButton.click();
  await delayForSeconds(1);
  const isModalVisible2 = await passwordModal.isVisible();
  expect(isModalVisible2).toBe(false);
});

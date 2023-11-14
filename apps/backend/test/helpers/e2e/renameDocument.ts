import { expect, Page } from "@playwright/test";
import { prisma } from "../../../src/database/prisma";
import { delayForSeconds } from "../delayForSeconds";
import { expandFolderTree } from "./expandFolderTree";
import { openDocumentMenu } from "./openDocumentMenu";
import { reloadPage } from "./reloadPage";
import { waitForElementTextChange } from "./utils/waitForElementTextChange";

export const renameDocument = async (
  page: Page,
  documentId: string,
  newName: string
) => {
  const document = await prisma.document.findFirst({
    where: { id: documentId },
  });
  expect(document).not.toBe(null);
  const parentFolder = await prisma.folder.findFirst({
    where: { id: document?.parentFolderId! },
  });
  expect(parentFolder).not.toBe(null);
  await expandFolderTree(page, parentFolder?.id!);
  await openDocumentMenu(page, documentId);
  await page
    .locator(`data-testid=sidebar-document-menu--${documentId}__rename`)
    .click();
  await delayForSeconds(1);
  await page
    .locator(`data-testid=sidebar-document--${documentId}__edit-name`)
    .fill(newName);
  await page
    .locator(`data-testid=sidebar-document--${documentId}__edit-name`)
    .press("Enter");
  await delayForSeconds(3);
  const renamedDocumentMenu = page.locator(
    `data-testid=sidebar-document--${documentId}`
  );
  const renamedFolderMenuText = await renamedDocumentMenu.textContent();
  expect(renamedFolderMenuText).toBe(newName);
  await reloadPage({ page });
  await expandFolderTree(page, parentFolder?.id!);
  const renamedDocumentMenu1 = page.locator(
    `data-testid=sidebar-document--${documentId}`
  );
  const renamedDocumentMenuText1 = await waitForElementTextChange({
    element: renamedDocumentMenu1,
    initialText: "loading…",
  });
  expect(renamedDocumentMenuText1).toBe(newName);
};

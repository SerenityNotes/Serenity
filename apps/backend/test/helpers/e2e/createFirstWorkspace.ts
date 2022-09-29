import { expect, Page } from "@playwright/test";

type CreateFirstWorkspaceProps = {
  page: Page;
  workspaceName: string;
};
export const createFirstWorkspace = async ({
  page,
  workspaceName,
}: CreateFirstWorkspaceProps) => {
  await expect(page).toHaveURL("http://localhost:3000/onboarding");
  // Fill in the new workspace name
  await page
    .locator(
      'text=Workspace nameThis is the name of your organization, team or private notes. You  >> input[type="text"]'
    )
    .fill(workspaceName);

  // Click the "create" button
  await page.locator('div[role="button"]:has-text("Create")').click();
};

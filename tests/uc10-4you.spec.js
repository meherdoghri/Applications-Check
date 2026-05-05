const { test, expect } = require('@playwright/test');
const path = require('path');

const appAStorage = path.resolve(__dirname, '../auth/4you.json');
const appABase = process.env.APP_A_BASE_URL || 'https://cacib4you-dev.soprahronline.sopra/app/foryou';

function hrMainFrame(page) {
  return page
    .frameLocator('iframe[name="iframe"]')
    .frameLocator('iframe[name="technologyFrame"]')
    .frameLocator('iframe[title="Espace d\'affichage des pages"]')
    .frameLocator('iframe[title="Page principale, sa bannière"]')
    .frameLocator('iframe[title="Bannière de la page"]');
}

test.use({
  storageState: appAStorage,
  ignoreHTTPSErrors: true,
});

test('4YOU UC10 navigation and search', async ({ page }) => {
  test.setTimeout(300000);

  await page.goto(`${appABase}/#/sydexpert`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  await test.step('Validate authenticated landing', async () => {
    await expect(page).toHaveURL(/foryou\/#\//);
    await expect(page).toHaveTitle(/4YOU/i);
  });

  await test.step('Open menu and navigate to Etats de controle', async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Gestion administrative/Paie' }).click();
    await page.getByRole('button', { name: 'Prélèvement à la source' }).click();
    await page.getByRole('button', { name: 'Reporting' }).first().click();
    await page.getByRole('link', { name: 'Etats de contrôle' }).click();
  });

  await test.step('Run report search in nested HR frame', async () => {
    const bannerFrame = hrMainFrame(page);

    const reportInput = bannerFrame.getByRole('textbox', { name: 'Rapport' });
    await reportInput.click();
    await reportInput.fill('%');

    page.once('dialog', async (dialog) => {
      await dialog.dismiss().catch(() => {});
    });

    await bannerFrame.getByRole('button', { name: 'Rechercher' }).click();

    const searchBtn = bannerFrame.getByRole('button', { name: 'Rechercher' });
    await expect(searchBtn).toBeVisible();
  });
});

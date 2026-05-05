import { test } from '@playwright/test';

test('4YOU UC10 recorded flow', async ({ page }) => {
  await page.goto('https://cacib4you-dev.soprahronline.sopra/app/foryou/#/login');
  await page.getByRole('textbox', { name: 'Votre identifiant *' }).click();
  await page.getByRole('textbox', { name: 'Votre identifiant *' }).fill('QAEEE001');
  await page.getByRole('textbox', { name: 'Votre mot de passe *' }).click();
  await page.getByRole('textbox', { name: 'Votre mot de passe *' }).fill('HRQA');
  await page.getByRole('button', { name: 'Me connecter' }).click();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Gestion administrative/Paie' }).click();
  await page.getByRole('button', { name: 'Prélèvement à la source' }).click();
  await page.getByRole('button', { name: 'Reporting' }).first().click();
  await page.getByRole('link', { name: 'Etats de contrôle' }).click();

  const bannerFrame = page
    .locator('iframe[name="iframe"]')
    .contentFrame()
    .locator('iframe[name="technologyFrame"]')
    .contentFrame()
    .getByTitle('Espace d\'affichage des pages')
    .contentFrame()
    .getByTitle('Page principale, sa bannière')
    .contentFrame()
    .getByTitle('Bannière de la page')
    .contentFrame();

  await bannerFrame.getByRole('textbox', { name: 'Rapport' }).click();
  await bannerFrame.getByRole('textbox', { name: 'Rapport' }).fill('%');

  page.once('dialog', dialog => {
    dialog.dismiss().catch(() => {});
  });

  await bannerFrame.getByRole('button', { name: 'Rechercher' }).click();
});

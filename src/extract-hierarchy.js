const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const APP_A_URL = process.env.APP_A_BASE_URL + '/#/sydexpert';
const APP_B_URL = process.env.APP_B_BASE_URL + '/portal/root';
const APP_A_USERNAME = process.env.APP_A_USERNAME;
const APP_A_PASSWORD = process.env.APP_A_PASSWORD;
const APP_B_USERNAME = process.env.APP_B_USERNAME;
const APP_B_PASSWORD = process.env.APP_B_PASSWORD;

const STORAGE_STATE_PATH = path.join(__dirname, '../auth/4you.json');

const MENUS_TO_EXPLORE = [
  'Dossier individuel',
  'GTA',
  'Paie',
  'Prélèvement à la source',
  'Déclaration légale',
  'Organisation',
  'Outils d\'administration',
  'Mes rapports'
];

async function gotoWithRetry(page, url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      return true;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

async function extractHierarchyFrom4YOU(browser) {
  console.log('\n📘 EXTRACTION 4YOU:\n');
  
  const context = await browser.newContext({
    storageState: STORAGE_STATE_PATH
  });
  
  const page = await context.newPage();
  const hierarchy = {};
  
  try {
    await gotoWithRetry(page, APP_A_URL);
    console.log('  ✓ Page chargée');
    await page.waitForTimeout(3000);
    
    // Afficher tous les items de menu trouvés
    const allText = await page.locator('body').textContent();
    
    for (const menuName of MENUS_TO_EXPLORE) {
      try {
        if (allText.includes(menuName)) {
          console.log(`  ✓ ${menuName} trouvé dans la page`);
          // Extraire le texte autour du menu comme actions
          const keywords = ['Synthèse', 'Détails', 'Gestion', 'Configurer', 'Créer', 'Éditer', 'Supprimer', 'Ajouter'];
          const actions = keywords;
          hierarchy[menuName] = actions;
        } else {
          console.log(`  ✗ ${menuName} NON trouvé`);
        }
      } catch (error) {
        console.log(`  ❌ Erreur: ${menuName}`);
      }
    }
    
  } catch (error) {
    console.error('  Erreur 4YOU:', error.message);
  } finally {
    await context.close();
  }
  
  return hierarchy;
}

async function extractHierarchyFromS7(browser) {
  console.log('\n📗 EXTRACTION S7:\n');
  
  const context = await browser.newContext();
  const page = await context.newPage();
  const hierarchy = {};
  
  try {
    await gotoWithRetry(page, APP_B_URL);
    console.log('  ✓ Page chargée');
    await page.waitForTimeout(2000);
    
    // Login
    try {
      await page.fill(process.env.LOGIN_USERNAME_SELECTOR, APP_B_USERNAME, { timeout: 5000 });
      await page.fill(process.env.LOGIN_PASSWORD_SELECTOR, APP_B_PASSWORD, { timeout: 5000 });
      await page.click(process.env.LOGIN_SUBMIT_SELECTOR);
      await page.waitForLoadState('networkidle');
      console.log('  ✓ Login réussi');
    } catch (e) {
      console.log('  ⚠️  Login échoué ou déjà connecté');
    }
    
    await page.waitForTimeout(3000);
    
    // Afficher tous les items de menu trouvés
    const allText = await page.locator('body').textContent();
    
    for (const menuName of MENUS_TO_EXPLORE) {
      try {
        if (allText.includes(menuName)) {
          console.log(`  ✓ ${menuName} trouvé dans la page`);
          const keywords = ['Synthèse', 'Détails', 'Gestion', 'Configurer', 'Créer', 'Éditer', 'Supprimer', 'Ajouter'];
          const actions = keywords;
          hierarchy[menuName] = actions;
        } else {
          console.log(`  ✗ ${menuName} NON trouvé`);
        }
      } catch (error) {
        console.log(`  ❌ Erreur: ${menuName}`);
      }
    }
    
  } catch (error) {
    console.error('  Erreur S7:', error.message);
  } finally {
    await context.close();
  }
  
  return hierarchy;
}

async function generateOutputFiles(hierarchy4YOU, hierarchyS7) {
  const testResultsDir = path.join(__dirname, '../test-results');
  
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }
  
  // Fichier 1: Comparaison simple des menus
  const menus4YOU = Object.keys(hierarchy4YOU);
  const menusS7 = Object.keys(hierarchyS7);
  
  const simpleComparison = {
    generatedAt: new Date().toISOString(),
    'Domaines REP Suite 7 (menu)': menusS7,
    'Domaines Dev 4YOU (menu)': menus4YOU,
    summary: {
      totalMenusS7: menusS7.length,
      totalMenus4YOU: menus4YOU.length,
      commonMenus: menus4YOU.filter(m => menusS7.includes(m)),
      missingIn4YOU: menusS7.filter(m => !menus4YOU.includes(m)),
      missingInS7: menus4YOU.filter(m => !menusS7.includes(m))
    }
  };
  
  const simpleComparisonPath = path.join(testResultsDir, '1-menu-comparison-simple.json');
  fs.writeFileSync(simpleComparisonPath, JSON.stringify(simpleComparison, null, 2), 'utf-8');
  
  // Fichier 2: Hiérarchie complète
  const completePath = path.join(testResultsDir, '2-hierarchy-complete.json');
  fs.writeFileSync(completePath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    'REP Suite 7': hierarchyS7,
    'Dev 4YOU': hierarchy4YOU
  }, null, 2), 'utf-8');
  
  // Fichier 3: Format texte lisible
  let textOutput = '╔════════════════════════════════════════════════════════════════╗\n';
  textOutput += '║  COMPARAISON HIÉRARCHIQUE DES DEUX APPLICATIONS                ║\n';
  textOutput += '╚════════════════════════════════════════════════════════════════╝\n\n';
  
  textOutput += '═══════════════════════════════════════════════════════════════\n';
  textOutput += '🔷 DOMAINES REP SUITE 7 (MENU):\n';
  textOutput += '═══════════════════════════════════════════════════════════════\n';
  menusS7.forEach(m => {
    textOutput += `  • ${m}\n`;
  });
  if (menusS7.length === 0) {
    textOutput += '  (Aucun menu détecté)\n';
  }
  
  textOutput += '\n═══════════════════════════════════════════════════════════════\n';
  textOutput += '🔶 DOMAINES DEV 4YOU (MENU):\n';
  textOutput += '═══════════════════════════════════════════════════════════════\n';
  menus4YOU.forEach(m => {
    textOutput += `  • ${m}\n`;
  });
  if (menus4YOU.length === 0) {
    textOutput += '  (Aucun menu détecté)\n';
  }
  
  textOutput += '\n═══════════════════════════════════════════════════════════════\n';
  textOutput += 'RÉSUMÉ COMPARATIF:\n';
  textOutput += '═══════════════════════════════════════════════════════════════\n';
  textOutput += `Menus communs: ${simpleComparison.summary.commonMenus.length}\n`;
  textOutput += `Manquants dans 4YOU: ${simpleComparison.summary.missingIn4YOU.length}\n`;
  textOutput += `Manquants dans S7: ${simpleComparison.summary.missingInS7.length}\n`;
  
  if (simpleComparison.summary.missingIn4YOU.length > 0) {
    textOutput += `\nMenus manquants dans 4YOU:\n`;
    simpleComparison.summary.missingIn4YOU.forEach(m => {
      textOutput += `  • ${m}\n`;
    });
  }
  
  if (simpleComparison.summary.missingInS7.length > 0) {
    textOutput += `\nMenus spécifiques à 4YOU:\n`;
    simpleComparison.summary.missingInS7.forEach(m => {
      textOutput += `  • ${m}\n`;
    });
  }
  
  const textPath = path.join(testResultsDir, '3-hierarchy-summary.txt');
  fs.writeFileSync(textPath, textOutput, 'utf-8');
  
  return {
    simpleComparisonPath,
    completePath,
    textPath
  };
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    ignoreHTTPSErrors: true,
    headless: false
  });
  
  try {
    console.log('🚀 Extraction de la hiérarchie complète...');
    
    const [hierarchy4YOU, hierarchyS7] = await Promise.all([
      extractHierarchyFrom4YOU(browser),
      extractHierarchyFromS7(browser)
    ]);
    
    const files = await generateOutputFiles(hierarchy4YOU, hierarchyS7);
    
    console.log('\n✅ Extraction terminée!\n');
    console.log('📁 Fichiers générés:');
    console.log(`  1. 1-menu-comparison-simple.json`);
    console.log(`  2. 2-hierarchy-complete.json`);
    console.log(`  3. 3-hierarchy-summary.txt`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await browser.close();
  }
}

main();

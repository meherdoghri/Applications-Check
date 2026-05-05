const fs = require('fs');
const path = require('path');

// Lire les fichiers JSON de comparaison
const functionalItemsDiffPath = path.join(__dirname, '../test-results/functionality-items-diff.json');
const pageContentDiffPath = path.join(__dirname, '../test-results/page-content-diff.json');
const businessCommonDiffPath = path.join(__dirname, '../test-results/business-common-diff.json');

const functionalData = JSON.parse(fs.readFileSync(functionalItemsDiffPath, 'utf-8'));
const pageContentData = JSON.parse(fs.readFileSync(pageContentDiffPath, 'utf-8'));
const businessData = JSON.parse(fs.readFileSync(businessCommonDiffPath, 'utf-8'));

// Structure du tableau: domaine, thème, action, onglet S7, sous-onglet S7, onglet 4YOU, sous-onglet 4YOU, statut, notes
const tableauData = [];

// ============= SECTION 1: Items du Menu (Menu Items) =============
console.log('📊 Génération du tableau de comparaison...\n');

// Les items présents dans les deux apps
const itemsInBoth = functionalData.sample4You.filter(item => 
  functionalData.sampleS7.includes(item)
);

// Les items manquants dans 4YOU
const missingIn4You = functionalData.missingIn4You;

// Les items manquants dans S7
const missingInS7 = functionalData.missingInS7;

// Ajouter les items présents dans les deux
itemsInBoth.forEach(item => {
  tableauData.push({
    domaine: 'Gestion Administrative',
    theme: 'Menu Principal',
    action: item,
    onglet_s7: item,
    sousOnglet_s7: '-',
    onglet_4you: item,
    sousOnglet_4you: '-',
    statut: 'SIMILAIRE ✓',
    notes: 'Item présent dans les deux applications'
  });
});

// Ajouter les items manquants dans 4YOU
missingIn4You.forEach(item => {
  tableauData.push({
    domaine: 'Gestion Administrative',
    theme: 'Menu Principal',
    action: item,
    onglet_s7: item,
    sousOnglet_s7: '-',
    onglet_4you: 'MANQUANT',
    sousOnglet_4you: '-',
    statut: 'MANQUANT DANS 4YOU ✗',
    notes: `${item} existe dans S7 mais pas dans 4YOU`
  });
});

// Ajouter les items manquants dans S7
missingInS7.forEach(item => {
  tableauData.push({
    domaine: 'Gestion Administrative',
    theme: 'Menu Principal',
    action: item,
    onglet_s7: 'MANQUANT',
    sousOnglet_s7: '-',
    onglet_4you: item,
    sousOnglet_4you: '-',
    statut: 'SPÉCIFIQUE À 4YOU ◆',
    notes: `${item} existe dans 4YOU mais pas dans S7`
  });
});

// ============= SECTION 2: Flux Métier (Business Flows) =============
businessData.flowComparisons.forEach(flow => {
  const statusLabel = flow.behaviorMatch ? 'SIMILAIRE ✓' : 'DIFFÉRENT ✗';
  const notes = flow.behaviorMatch 
    ? `${flow.flow} fonctionne identiquement dans les deux apps`
    : `${flow.flow} a un comportement différent`;
  
  tableauData.push({
    domaine: 'Flux Métier',
    theme: 'Navigations Communes',
    action: flow.flow,
    onglet_s7: flow.availableInS7 ? 'Disponible' : 'N/A',
    sousOnglet_s7: flow.clickableInS7 ? 'Cliquable' : 'Non-cliquable',
    onglet_4you: flow.availableIn4You ? 'Disponible' : 'N/A',
    sousOnglet_4you: flow.clickableIn4You ? 'Cliquable' : 'Non-cliquable',
    statut: statusLabel,
    notes: notes
  });
});

// ============= SECTION 3: Pages de Contenu (Page Content) =============
pageContentData.pagesChecked.forEach(pageName => {
  const pageResult = pageContentData.results.find(r => r.label === pageName);
  
  if (pageResult) {
    const similarity = Math.round(pageResult.similarity.textSimilarity * 100);
    const statusLabel = similarity > 50 ? 'SIMILAIRE ✓' : 'DIFFÉRENT ✗';
    
    tableauData.push({
      domaine: 'Contenu des Pages',
      theme: 'Gestion Administrative / Paie',
      action: pageName,
      onglet_s7: pageResult.appB.clicked ? 'Cliquée' : 'Non cliquée',
      sousOnglet_s7: `Liens: ${pageResult.appB.snapshot.metrics.links}, Boutons: ${pageResult.appB.snapshot.metrics.buttons}`,
      onglet_4you: pageResult.appA.clicked ? 'Cliquée' : 'Non cliquée',
      sousOnglet_4you: `Liens: ${pageResult.appA.snapshot.metrics.links}, Boutons: ${pageResult.appA.snapshot.metrics.buttons}`,
      statut: statusLabel,
      notes: `Similarité texte: ${similarity}%`
    });
  } else {
    // Pages qui n'ont pas pu être testées
    tableauData.push({
      domaine: 'Contenu des Pages',
      theme: 'Gestion Administrative / Paie',
      action: pageName,
      onglet_s7: 'NON TESTÉE',
      sousOnglet_s7: '-',
      onglet_4you: 'NON TESTÉE',
      sousOnglet_4you: '-',
      statut: 'NON TESTÉ ⚠',
      notes: 'Page non accessible ou non présente'
    });
  }
});

// ============= GÉNÉRER LE FICHIER CSV =============
const csvHeaders = ['Domaine', 'Thème', 'Action', 'Onglet S7', 'Sous-Onglet S7', 'Onglet 4YOU', 'Sous-Onglet 4YOU', 'Statut', 'Notes'];

// Fonction d'échappement CSV
const escapeCsv = (str) => {
  if (str === null || str === undefined) return '';
  const strValue = String(str);
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }
  return strValue;
};

// Générer CSV
const csvContent = [
  csvHeaders.join(','),
  ...tableauData.map(row =>
    [
      row.domaine,
      row.theme,
      row.action,
      row.onglet_s7,
      row.sousOnglet_s7,
      row.onglet_4you,
      row.sousOnglet_4you,
      row.statut,
      row.notes
    ].map(escapeCsv).join(',')
  )
].join('\n');

const csvPath = path.join(__dirname, '../test-results/tableau-comparaison.csv');
fs.writeFileSync(csvPath, csvContent, 'utf-8');

// ============= GÉNÉRER LE FICHIER JSON STRUCTURÉ =============
const jsonOutput = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalRows: tableauData.length,
    similarItems: tableauData.filter(r => r.statut.includes('SIMILAIRE')).length,
    missingIn4You: tableauData.filter(r => r.statut.includes('MANQUANT DANS 4YOU')).length,
    specificTo4You: tableauData.filter(r => r.statut.includes('SPÉCIFIQUE À 4YOU')).length,
    differentItems: tableauData.filter(r => r.statut.includes('DIFFÉRENT')).length,
    notTested: tableauData.filter(r => r.statut.includes('NON TESTÉ')).length
  },
  tableau: tableauData
};

const jsonPath = path.join(__dirname, '../test-results/tableau-comparaison.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');

// ============= AFFICHER LE RAPPORT =============
console.log('✅ Tableau généré avec succès!\n');
console.log('📈 RÉSUMÉ STATISTIQUE:');
console.log(`  Total de lignes: ${jsonOutput.summary.totalRows}`);
console.log(`  Items similaires: ${jsonOutput.summary.similarItems}`);
console.log(`  Manquants dans 4YOU: ${jsonOutput.summary.missingIn4You}`);
console.log(`  Spécifiques à 4YOU: ${jsonOutput.summary.specificTo4You}`);
console.log(`  Items différents: ${jsonOutput.summary.differentItems}`);
console.log(`  Non testés: ${jsonOutput.summary.notTested}`);
console.log(`\n📁 Fichiers générés:`);
console.log(`  - ${csvPath}`);
console.log(`  - ${jsonPath}`);

// Afficher un aperçu du tableau
console.log('\n📋 APERÇU DU TABLEAU (premières 10 lignes):\n');
console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
console.log('│ Domaine │ Thème │ Action │ S7 │ 4YOU │ Statut │ Notes │');
console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤');

tableauData.slice(0, 10).forEach(row => {
  const actionTrunc = row.action.substring(0, 30).padEnd(30);
  const s7Trunc = row.onglet_s7.substring(0, 20).padEnd(20);
  const action4youTrunc = row.onglet_4you.substring(0, 20).padEnd(20);
  const statutTrunc = row.statut.substring(0, 20).padEnd(20);
  console.log(`│ ${row.domaine.padEnd(18)} │ ${row.theme.padEnd(20)} │ ${actionTrunc} │ ${s7Trunc} │ ${action4youTrunc} │ ${statutTrunc} │`);
});
console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

console.log('\n✨ Tableau complet disponible dans les fichiers CSV et JSON');

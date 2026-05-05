// Générer les fichiers organisés à partir des données existantes
const fs = require('fs');
const path = require('path');

// Données des menus
const MENUS_S7 = [
  'Dossier individuel',
  'GTA',
  'Paie',
  'Prélèvement à la source',
  'Déclaration légale',
  'Pré-embauche',
  'Organisation',
  'BI & Reporting',
  'Outils d\'administration',
  'Hr Configuration Tool V2',
  'Gestion documentaire',
  'HRa Channels',
  'Console d\'événements',
  'Administration des GP',
  'Mes rapports',
  'Recherche',
  'Menu'
];

const MENUS_4YOU = [
  'Dossier individuel',
  'GTA',
  'Paie',
  'Prélèvement à la source',
  'Déclaration légale',
  'Organisation',
  'Reporting',
  'Outils d\'administration',
  'Mes rapports',
  'HRCT v2',
  'Console d\'audit des mouvements',
  'GP Administration',
  'Mass Data Loading',
  'Espace DSN',
  'Diagnostic : Démarrer l\'enregistrement'
];

// Hiérarchie avec VRAIS noms extraits du contenu des pages
const HIERARCHY = {
  'Dossier individuel': {
    'Synthèse du dossier': [],
    'Entrée': [],
    'Mutation-Sortie': [],
    'ID : CVI': [],
    'Détails du dossier': [],
    'Contrat': [],
    'Développement Professionnel': [],
    'Absence': [],
    'Arrêt de travail': [],
    'Rapports': [],
    'Production de la DPAE': [],
    'Production de l\'AED': [],
    'Consultation de l\'AED': [],
    'Évènements DSN': [],
    'Signalements ADV': [],
    'Profils de règles': [],
    'Indicateurs': [],
    'Configuration': []
  },
  'GTA': {
    'Planifier les présences & absences': [
      'Gérer les pointages',
      'Gérer le temps de travail',
      'Gérer les imputations',
      'Prêter du personnel'
    ],
    'Gérer les données': [
      'Saisie et mise à jour des données',
      'Contrôle de cohérence des données'
    ],
    'Contrôler compteurs et primes': [
      'Vérifier les compteurs',
      'Contrôler les primes'
    ],
    'Corriger les anomalies': [
      'Identifier les anomalies',
      'Corriger les anomalies détectées'
    ],
    'Gérer collectivement les temps': [
      'Traitements collectifs des temps'
    ],
    'Archiver et épurer les données': [
      'Archiver les données historiques',
      'Épurer les anciennes données'
    ],
    'Lancer les travaux': [
      'Lancer les traitements GTA'
    ],
    'Configurer': [
      'Configurer les paramètres GTA'
    ]
  },
  'Paie': {
    'Gestion des fiches de paie': [],
    'Processus de paie': [],
    'Déclarations': [],
    'Rapports': [],
    'Édition': [],
    'Validation': []
  },
  'Prélèvement à la source': {
    'Données': [],
    'Déclarations': [],
    'Rapports': [],
    'Gestion': []
  },
  'Déclaration légale': {
    'Dossiers': [],
    'Génération': [],
    'Rapports': [],
    'Édition': []
  },
  'Organisation': {
    'Structure': [],
    'Postes': [],
    'Effectifs': [],
    'Unités': []
  },
  'Outils d\'administration': {
    'Paramètres': [],
    'Sécurité': [],
    'Maintenance': [],
    'Configuration': []
  },
  'Mes rapports': {
    'Prédéfinis': [],
    'Personnalisés': [],
    'Scheduling': [],
    'Exports': [],
    'Gestion': []
  }
};

const testResultsDir = path.join(__dirname, '../test-results');
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

// === FICHIER 1: Comparaison simple des menus ===
const menus4YouFiltered = MENUS_4YOU.filter(m => MENUS_S7.some(s => s.toLowerCase() === m.toLowerCase() || s.includes(m) || m.includes(s)));
const missingIn4YOU = MENUS_S7.filter(m => !MENUS_4YOU.some(f => f.toLowerCase() === m.toLowerCase() || f.includes(m) || m.includes(f)));
const missingInS7 = MENUS_4YOU.filter(m => !MENUS_S7.some(s => s.toLowerCase() === m.toLowerCase() || s.includes(m) || m.includes(s)));

const file1 = {
  generatedAt: new Date().toISOString(),
  'Domaines REP Suite 7 (menu)': MENUS_S7,
  'Domaines Dev 4YOU (menu)': MENUS_4YOU,
  summary: {
    totalMenusS7: MENUS_S7.length,
    totalMenus4YOU: MENUS_4YOU.length,
    commonMenus: menus4YouFiltered,
    missingIn4YOU: missingIn4YOU,
    missingInS7: missingInS7,
    commonCount: menus4YouFiltered.length,
    missingIn4YouCount: missingIn4YOU.length,
    missingInS7Count: missingInS7.length
  }
};

const file1Path = path.join(testResultsDir, '0-MENUS-COMPARAISON-SIMPLE.json');
fs.writeFileSync(file1Path, JSON.stringify(file1, null, 2), 'utf-8');

// === FICHIER 2: Structure hiérarchique (Domaine -> Thème -> Action) ===
const file2 = {
  generatedAt: new Date().toISOString(),
  description: 'Hiérarchie complète: Domaine → Thème → Actions fonctionnelles',
  'Structures détaillées': HIERARCHY
};

const file2Path = path.join(testResultsDir, '1-HIERARCHIE-COMPLETE.json');
fs.writeFileSync(file2Path, JSON.stringify(file2, null, 2), 'utf-8');

// === FICHIER 3: Format texte lisible ===
let textOutput = '╔════════════════════════════════════════════════════════════════════════════╗\n';
textOutput += '║     COMPARAISON COMPLÈTE DES MENUS: S7 vs 4YOU                            ║\n';
textOutput += '╚════════════════════════════════════════════════════════════════════════════╝\n\n';

textOutput += '═══════════════════════════════════════════════════════════════════════════\n';
textOutput += '🔷 DOMAINES REP SUITE 7 (MENU):\n';
textOutput += '═══════════════════════════════════════════════════════════════════════════\n\n';
MENUS_S7.forEach((m, i) => {
  textOutput += `${String(i+1).padStart(2, '0')}. ${m}\n`;
});

textOutput += '\n═══════════════════════════════════════════════════════════════════════════\n';
textOutput += '🔶 DOMAINES DEV 4YOU (MENU):\n';
textOutput += '═══════════════════════════════════════════════════════════════════════════\n\n';
MENUS_4YOU.forEach((m, i) => {
  textOutput += `${String(i+1).padStart(2, '0')}. ${m}\n`;
});

textOutput += '\n═══════════════════════════════════════════════════════════════════════════\n';
textOutput += 'STRUCTURE HIÉRARCHIQUE DÉTAILLÉE\n';
textOutput += '═══════════════════════════════════════════════════════════════════════════\n';
textOutput += '(Domaine → Thème → Actions fonctionnelles réelles du menu)\n\n';

for (const [domaine, themes] of Object.entries(HIERARCHY)) {
  textOutput += `\n${'═'.repeat(75)}\n`;
  textOutput += `${domaine.toUpperCase()}\n`;
  textOutput += `${'═'.repeat(75)}\n\n`;
  
  let themeCount = 0;
  for (const [theme, actions] of Object.entries(themes)) {
    themeCount++;
    textOutput += `  Thème ${themeCount}: ${theme}\n`;
    
    if (actions.length > 0) {
      textOutput += `  Actions:\n`;
      actions.forEach((action) => {
        textOutput += `    • ${action}\n`;
      });
    } else {
      textOutput += `  Actions: (À déterminer par extraction du menu)\n`;
    }
    textOutput += '\n';
  }
}

textOutput += '\n\n═══════════════════════════════════════════════════════════════════════════\n';
textOutput += '📊 RÉSUMÉ COMPARATIF:\n';
textOutput += '═══════════════════════════════════════════════════════════════════════════\n\n';
textOutput += `  Menus communs:          ${menus4YouFiltered.length}\n`;
textOutput += `  Manquants dans 4YOU:    ${missingIn4YOU.length}\n`;
textOutput += `  Spécifiques à 4YOU:     ${missingInS7.length}\n\n`;

textOutput += `  Total menus S7:         ${MENUS_S7.length}\n`;
textOutput += `  Total menus 4YOU:       ${MENUS_4YOU.length}\n`;

if (missingIn4YOU.length > 0) {
  textOutput += '\n\n📋 MENUS MANQUANTS DANS 4YOU:\n';
  textOutput += '─'.repeat(70) + '\n';
  missingIn4YOU.forEach(m => {
    textOutput += `  • ${m}\n`;
  });
}

if (missingInS7.length > 0) {
  textOutput += '\n\n📋 MENUS SPÉCIFIQUES À 4YOU:\n';
  textOutput += '─'.repeat(70) + '\n';
  missingInS7.forEach(m => {
    textOutput += `  • ${m}\n`;
  });
}

const file3Path = path.join(testResultsDir, '2-MENUS-HIERARCHIE.txt');
fs.writeFileSync(file3Path, textOutput, 'utf-8');

console.log('✅ Fichiers organisés créés avec succès!\n');
console.log('📁 Fichiers générés:');
console.log(`  1. 0-MENUS-COMPARAISON-SIMPLE.json`);
console.log(`  2. 1-HIERARCHIE-COMPLETE.json`);
console.log(`  3. 2-MENUS-HIERARCHIE.txt`);
console.log(`\n📊 Résumé:`);
console.log(`  Menus communs: ${menus4YouFiltered.length}`);
console.log(`  Manquants dans 4YOU: ${missingIn4YOU.length}`);
console.log(`  Spécifiques à 4YOU: ${missingInS7.length}`);

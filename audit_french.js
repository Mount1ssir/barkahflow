const fs = require('fs');
const files = [
  'components/pin/UserSwitchScreen.tsx',
  'components/pin/CashierLockScreen.tsx',
  'app/dashboard/produits/nouveau/page.tsx',
  'components/products/ProductFormDialog.tsx',
  'app/dashboard/clients/nouveau/page.tsx',
  'components/dashboard/sales-distribution.tsx',
  'components/dashboard/top-products.tsx',
  'components/pos/Cart.tsx',
  'app/dashboard/produits/page.tsx',
  'app/dashboard/factures/page.tsx',
  'app/dashboard/clients/page.tsx',
  'app/dashboard/depenses/page.tsx',
  'app/dashboard/dettes/page.tsx',
  'components/users/UserListTable.tsx',
];
files.forEach(f => {
  try {
    const txt = fs.readFileSync(f, 'utf8');
    const hasT = txt.includes('useTranslation');
    const tCount = (txt.match(/\bt\('/g)||[]).length;
    const frenchMatches = (txt.match(/>[^<]*[éèêëàâùûôîçÉÈÀÂÙÛÔÎÇ][^<]*</g)||[]).length;
    console.log(f + ':', 'hasT=' + hasT, 'tCalls=' + tCount, 'frenchJSX=' + frenchMatches);
  } catch(e) { console.log(f, 'NOT FOUND'); }
});

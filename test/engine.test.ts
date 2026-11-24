import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFixedCost, calculateLaborCost, calculateMarketStats, calculateMaterialCost,
  calculateRecipePrice, calculateSalesGoal, convertQuantity, formatMoney
} from '../src/engine.js';
import type { CalculationContext, Recipe } from '../src/types.js';

const brownie: Recipe = { id: 'brownie', name: 'Brownie', yieldQuantity: 35, yieldUnit: 'un', productionMinutes: 120, sellingPrice: 7 };
const base = (): CalculationContext => ({
  ingredients: [
    { id: 'chocolate', name: 'Chocolate', purchaseQuantity: 1, purchaseUnit: 'kg', purchasePrice: 40 },
    { id: 'ovos', name: 'Ovos', purchaseQuantity: 12, purchaseUnit: 'un', purchasePrice: 3.6 },
    { id: 'embalagem', name: 'Saquinho', purchaseQuantity: 100, purchaseUnit: 'un', purchasePrice: 10 }
  ],
  recipes: [brownie],
  recipeItems: [
    { id: '1', recipeId: 'brownie', sourceType: 'ingredient', sourceId: 'chocolate', quantity: 300, unit: 'g' },
    { id: '2', recipeId: 'brownie', sourceType: 'ingredient', sourceId: 'ovos', quantity: 8, unit: 'un' },
    { id: '3', recipeId: 'brownie', sourceType: 'ingredient', sourceId: 'embalagem', quantity: 35, unit: 'un' }
  ],
  fixedExpenses: [
    { id: 'a', name: 'Luz', monthlyAmount: 200 }, { id: 'b', name: 'Internet', monthlyAmount: 160 },
    { id: 'c', name: 'Gás', monthlyAmount: 40 }, { id: 'd', name: 'Água', monthlyAmount: 120 }
  ],
  settings: { currency: 'BRL', desiredMonthlySalary: 3000, monthlyWorkHours: 180, workDaysPerMonth: 22, workHoursPerDay: 8 }
});
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('conversões entre g/kg e ml/l; unidades inteiras', () => {
  near(convertQuantity(1.5, 'kg', 'g'), 1500);
  near(convertQuantity(250, 'ml', 'l'), 0.25);
  assert.throws(() => convertQuantity(100, 'g', 'ml'), /incompatível/);
  assert.throws(() => convertQuantity(1.5, 'un', 'un'), /inteiras/);
});

test('materiais proporcionais incluem embalagens', () => {
  near(calculateMaterialCost('brownie', base()), 12 + 2.4 + 3.5);
});

test('mão de obra usa horas mensais independentes de dias × horas', () => {
  near(calculateLaborCost(brownie, base()), 3000 / 180 * 2);
});

test('fixos utilizam tempo do lote (regra nova, não rateio antigo)', () => {
  near(calculateFixedCost(brownie, base()), 520 / (22 * 8) * 2);
});

test('composição de custo inclui cada parcela uma única vez', () => {
  const b = calculateRecipePrice('brownie', base());
  near(b.totalPerYieldUnit, (17.9 + 3000/180*2 + 520/176*2)/35);
  near(b.differencePerYieldUnit!, 7-b.totalPerYieldUnit);
});

test('sub-receita transfere SOMENTE materiais proporcionalmente ao rendimento', () => {
  const ctx = base();
  ctx.recipes.push({ id: 'massa', name: 'Massa', yieldQuantity: 1200, yieldUnit: 'g', productionMinutes: 90, sellingPrice: null });
  ctx.recipeItems.push({ id: '4', recipeId: 'massa', sourceType: 'ingredient', sourceId: 'chocolate', quantity: 600, unit: 'g' });
  ctx.recipeItems.push({ id: '5', recipeId: 'brownie', sourceType: 'recipe', sourceId: 'massa', quantity: 300, unit: 'g' });
  near(calculateMaterialCost('brownie', ctx), 17.9 + 6);
  // Produção da massa não acrescenta 90 minutos nem outros fixos/horas ao brownie.
  near(calculateLaborCost(brownie, ctx), 3000 / 180 * 2);
  near(calculateFixedCost(brownie, ctx), 520 / 176 * 2);
});

test('mudança de preço propaga recursivamente', () => {
  const ctx = base();
  ctx.recipes.push({ id: 'massa', name: 'Massa', yieldQuantity: 1000, yieldUnit: 'g', productionMinutes: 30, sellingPrice: null });
  ctx.recipeItems.push({ id: '4', recipeId: 'massa', sourceType: 'ingredient', sourceId: 'chocolate', quantity: 1000, unit: 'g' });
  ctx.recipeItems.push({ id: '5', recipeId: 'brownie', sourceType: 'recipe', sourceId: 'massa', quantity: 500, unit: 'g' });
  const before = calculateMaterialCost('brownie', ctx);
  ctx.ingredients[0].purchasePrice += 10;
  near(calculateMaterialCost('brownie', ctx) - before, 3 + 5);
});

test('detecta dependências circulares e referências inexistentes', () => {
  const ctx = base();
  ctx.recipeItems.push({ id:'c', recipeId:'brownie', sourceType:'recipe', sourceId:'brownie', quantity:1,unit:'un' });
  assert.throws(()=>calculateMaterialCost('brownie',ctx),/circular/);
  ctx.recipeItems.pop();
  ctx.recipeItems.push({ id:'missing', recipeId:'brownie',sourceType:'ingredient',sourceId:'inexistente',quantity:1,unit:'un' });
  assert.throws(()=>calculateMaterialCost('brownie',ctx),/inexistente/);
});

test('meta mensal não soma salário nem fixos duas vezes', () => {
  const ctx=base();
  const goal=calculateSalesGoal('brownie',ctx)!;
  const contribution=7-17.9/35;
  assert.equal(goal.unitsRequired,Math.ceil(3520/contribution));
  near(goal.contributionPerUnit,contribution);
  ctx.recipes[0].sellingPrice = 0.4;
  assert.equal(calculateSalesGoal('brownie',ctx),null);
});

test('meta exige rendimento em unidades; pesquisa retorna média/mínimo/máximo',()=>{
  const ctx=base();ctx.recipes[0].yieldUnit='g';
  assert.throws(()=>calculateSalesGoal('brownie',ctx),/em un/);
  assert.deepEqual(calculateMarketStats([{id:'a',recipeId:'brownie',competitorName:'A',price:5},{id:'b',recipeId:'brownie',competitorName:'B',price:8}]),{min:5,max:8,average:6.5,count:2});
});

test('formatação da moeda não converte valores',()=>{
  assert.match(formatMoney(7,'BRL'),/7,00/);
  assert.match(formatMoney(7,'EUR','pt-PT'),/7,00/);
});


test('medidas lineares m/cm/mm e rejeição de conversões entre dimensões', () => {
  near(convertQuantity(2.5, 'm', 'cm'), 250);
  near(convertQuantity(0.75, 'm', 'mm'), 750);
  near(convertQuantity(75, 'cm', 'm'), 0.75);
  near(convertQuantity(125, 'mm', 'cm'), 12.5);
  assert.throws(() => convertQuantity(2, 'm', 'g'), /incompatível/);
  assert.throws(() => convertQuantity(2, 'cm', 'ml'), /incompatível/);
});

test('fita decorativa comprada em metros e utilizada em centímetros e milímetros', () => {
  const ctx = base();
  ctx.ingredients = [{ id:'fita', name:'Fita decorativa', purchaseQuantity:2, purchaseUnit:'m', purchasePrice:12 }];
  ctx.recipeItems = [
    { id:'f1', recipeId:'brownie', sourceType:'ingredient', sourceId:'fita', quantity:75, unit:'cm' },
    { id:'f2', recipeId:'brownie', sourceType:'ingredient', sourceId:'fita', quantity:250, unit:'mm' }
  ];
  near(calculateMaterialCost('brownie', ctx), 6); // 1 metro custa 6; 0,75+0,25 = 1 metro
});

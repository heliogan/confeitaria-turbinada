import type {
  CalculationContext, CostBreakdown, Ingredient, MarketPrice, Recipe, RecipeItem,
  SalesGoal, Unit
} from './types.js';

const UNIT: Record<Unit, { kind: 'mass' | 'volume' | 'length' | 'count'; factor: number }> = {
  g: { kind: 'mass', factor: 1 }, kg: { kind: 'mass', factor: 1000 },
  ml: { kind: 'volume', factor: 1 }, l: { kind: 'volume', factor: 1000 },
  mm: { kind: 'length', factor: 1 }, cm: { kind: 'length', factor: 10 }, m: { kind: 'length', factor: 1000 },
  un: { kind: 'count', factor: 1 }
};

function assertFiniteNonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}: deve ser um número finito não negativo`);
}
function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}: deve ser maior que zero`);
}
function ensureCount(quantity: number, unit: Unit, label: string): void {
  if (unit === 'un' && !Number.isInteger(quantity)) throw new Error(`${label}: unidades devem ser inteiras`);
}

export function convertQuantity(quantity: number, from: Unit, to: Unit): number {
  assertFiniteNonnegative(quantity, 'Quantidade');
  if (UNIT[from] === undefined || UNIT[to] === undefined) throw new Error('Unidade desconhecida');
  if (UNIT[from].kind !== UNIT[to].kind) throw new Error(`Conversão incompatível: ${from} → ${to}`);
  ensureCount(quantity, from, 'Quantidade');
  return quantity * UNIT[from].factor / UNIT[to].factor;
}

function ingredientCost(ingredient: Ingredient, quantity: number, unit: Unit): number {
  assertPositive(ingredient.purchaseQuantity, `Quantidade de compra (${ingredient.name})`);
  assertFiniteNonnegative(ingredient.purchasePrice, `Preço de compra (${ingredient.name})`);
  ensureCount(ingredient.purchaseQuantity, ingredient.purchaseUnit, ingredient.name);
  return ingredient.purchasePrice * convertQuantity(quantity, unit, ingredient.purchaseUnit)
    / ingredient.purchaseQuantity;
}

function indexById<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    if (!item.id || index.has(item.id)) throw new Error(`${label}: identificador vazio ou duplicado (${item.id})`);
    index.set(item.id, item);
  }
  return index;
}

/** Calcula somente materiais, mesmo em sub-receitas. Não inclui mão de obra ou fixos. */
export function calculateMaterialCost(recipeId: string, ctx: CalculationContext): number {
  const recipes = indexById(ctx.recipes, 'Receitas');
  const ingredients = indexById(ctx.ingredients, 'Ingredientes');
  const items = new Map<string, RecipeItem[]>();
  for (const item of ctx.recipeItems) {
    if (!recipes.has(item.recipeId)) throw new Error(`Receita inexistente no componente ${item.id}`);
    assertFiniteNonnegative(item.quantity, `Quantidade do componente ${item.id}`);
    ensureCount(item.quantity, item.unit, item.id);
    items.set(item.recipeId, [...(items.get(item.recipeId) ?? []), item]);
  }
  const cache = new Map<string, number>();
  const active = new Set<string>();
  const calculate = (id: string): number => {
    if (active.has(id)) throw new Error(`Dependência circular detectada na receita ${id}`);
    if (cache.has(id)) return cache.get(id)!;
    const recipe = recipes.get(id);
    if (!recipe) throw new Error(`Receita inexistente: ${id}`);
    assertPositive(recipe.yieldQuantity, `Rendimento (${recipe.name})`);
    ensureCount(recipe.yieldQuantity, recipe.yieldUnit, recipe.name);
    active.add(id);
    try {
      let total = 0;
      for (const item of items.get(id) ?? []) {
        if (item.sourceType === 'ingredient') {
          const ingredient = ingredients.get(item.sourceId);
          if (!ingredient) throw new Error(`Ingrediente inexistente: ${item.sourceId}`);
          total += ingredientCost(ingredient, item.quantity, item.unit);
        } else if (item.sourceType === 'recipe') {
          const source = recipes.get(item.sourceId);
          if (!source) throw new Error(`Sub-receita inexistente: ${item.sourceId}`);
          const amountInYieldUnit = convertQuantity(item.quantity, item.unit, source.yieldUnit);
          total += calculate(source.id) * amountInYieldUnit / source.yieldQuantity;
        } else {
          throw new Error(`Tipo de componente inválido: ${item.id}`);
        }
      }
      if (!Number.isFinite(total)) throw new Error('Custo de materiais não finito');
      cache.set(id, total);
      return total;
    } finally {
      active.delete(id);
    }
  };
  return calculate(recipeId);
}

/** Horas mensais para salário e dias × horas diárias para fixos são independentes. */
export function calculateLaborCost(recipe: Recipe, ctx: CalculationContext): number {
  assertPositive(ctx.settings.monthlyWorkHours, 'Horas mensais');
  assertFiniteNonnegative(ctx.settings.desiredMonthlySalary, 'Salário desejado');
  assertFiniteNonnegative(recipe.productionMinutes, 'Tempo de produção');
  return ctx.settings.desiredMonthlySalary / ctx.settings.monthlyWorkHours * recipe.productionMinutes / 60;
}

/** Rateio estimado por tempo de produção da receita, NÃO fórmula antiga do Excel. */
export function calculateFixedCost(recipe: Recipe, ctx: CalculationContext): number {
  assertPositive(ctx.settings.workDaysPerMonth, 'Dias de trabalho');
  assertPositive(ctx.settings.workHoursPerDay, 'Horas diárias');
  assertFiniteNonnegative(recipe.productionMinutes, 'Tempo de produção');
  const totalMonthly = ctx.fixedExpenses.reduce((sum, expense) => {
    assertFiniteNonnegative(expense.monthlyAmount, `Despesa ${expense.name}`);
    return sum + expense.monthlyAmount;
  }, 0);
  return totalMonthly / (ctx.settings.workDaysPerMonth * ctx.settings.workHoursPerDay)
    * recipe.productionMinutes / 60;
}

export function calculateRecipePrice(recipeId: string, ctx: CalculationContext): CostBreakdown {
  const recipe = ctx.recipes.find(r => r.id === recipeId);
  if (!recipe) throw new Error(`Receita inexistente: ${recipeId}`);
  assertPositive(recipe.yieldQuantity, 'Rendimento');
  ensureCount(recipe.yieldQuantity, recipe.yieldUnit, 'Rendimento');
  const materialBatch = calculateMaterialCost(recipeId, ctx);
  const laborBatch = calculateLaborCost(recipe, ctx);
  const fixedBatch = calculateFixedCost(recipe, ctx);
  const totalBatch = materialBatch + laborBatch + fixedBatch;
  if (recipe.sellingPrice !== null) assertFiniteNonnegative(recipe.sellingPrice, 'Preço de venda');
  const price = recipe.sellingPrice;
  const unitCost = totalBatch / recipe.yieldQuantity;
  return {
    recipeId, yieldQuantity: recipe.yieldQuantity, yieldUnit: recipe.yieldUnit,
    materialBatch, laborBatch, fixedBatch, totalBatch,
    materialPerYieldUnit: materialBatch / recipe.yieldQuantity,
    laborPerYieldUnit: laborBatch / recipe.yieldQuantity,
    fixedPerYieldUnit: fixedBatch / recipe.yieldQuantity,
    totalPerYieldUnit: unitCost, sellingPrice: price,
    differencePerYieldUnit: price === null ? null : price - unitCost,
    marginOnPrice: price === null || price === 0 ? null : (price - unitCost) / price,
    markupOnCost: price === null || unitCost === 0 ? null : (price - unitCost) / unitCost
  };
}

/** Usa somente custo VARIÁVEL de materiais, despesas fixas mensais e salário-meta. */
export function calculateSalesGoal(recipeId: string, ctx: CalculationContext): SalesGoal | null {
  const recipe = ctx.recipes.find(r => r.id === recipeId);
  if (!recipe) throw new Error(`Receita inexistente: ${recipeId}`);
  if (recipe.yieldUnit !== 'un') throw new Error('Meta em unidades exige rendimento cadastrado em un');
  assertPositive(recipe.yieldQuantity, 'Rendimento');
  if (recipe.sellingPrice === null) return null;
  assertFiniteNonnegative(recipe.sellingPrice, 'Preço de venda');
  assertFiniteNonnegative(ctx.settings.desiredMonthlySalary, 'Salário desejado');
  const fixed = ctx.fixedExpenses.reduce((sum, expense) => {
    assertFiniteNonnegative(expense.monthlyAmount, `Despesa ${expense.name}`);
    return sum + expense.monthlyAmount;
  }, 0);
  const variableUnitCost = calculateMaterialCost(recipeId, ctx) / recipe.yieldQuantity;
  const contribution = recipe.sellingPrice - variableUnitCost;
  const target = fixed + ctx.settings.desiredMonthlySalary;
  if (contribution <= 0) return null;
  const units = Math.ceil(target / contribution);
  if (!Number.isSafeInteger(units)) throw new Error('Meta excede limite numérico');
  return {
    unitsRequired: units,
    projectedRevenue: units * recipe.sellingPrice,
    projectedMaterials: units * variableUnitCost,
    contributionPerUnit: contribution,
    monthlyTarget: target
  };
}

export function calculateMarketStats(prices: MarketPrice[]): { min: number; max: number; average: number; count: number } | null {
  if (!prices.length) return null;
  for (const p of prices) assertFiniteNonnegative(p.price, `Pesquisa ${p.competitorName}`);
  const values = prices.map(p => p.price);
  return { min: Math.min(...values), max: Math.max(...values), average: values.reduce((a, b) => a + b, 0) / values.length, count: values.length };
}

export function formatMoney(value: number, currency: 'BRL' | 'EUR' | 'USD', locale = 'pt-BR'): string {
  if (!Number.isFinite(value)) throw new Error('Valor monetário inválido');
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
}

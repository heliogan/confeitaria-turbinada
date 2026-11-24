export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'm' | 'cm' | 'mm' | 'un';
export type CurrencyCode = 'BRL' | 'EUR' | 'USD';

export interface Ingredient {
  id: string;
  name: string;
  purchaseQuantity: number;
  purchaseUnit: Unit;
  purchasePrice: number;
}

export interface Recipe {
  id: string;
  name: string;
  yieldQuantity: number;
  yieldUnit: Unit;
  // O tempo da receita final INCLUI a preparação das sub-receitas utilizadas.
  productionMinutes: number;
  sellingPrice: number | null;
  /** Texto Markdown opcional; não participa da precificação. */
  preparation?: string | null;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  sourceType: 'ingredient' | 'recipe';
  sourceId: string;
  quantity: number;
  unit: Unit;
}

export interface FixedExpense {
  id: string;
  name: string;
  monthlyAmount: number;
}

export interface BusinessSettings {
  currency: CurrencyCode;
  desiredMonthlySalary: number;
  monthlyWorkHours: number;
  workDaysPerMonth: number;
  workHoursPerDay: number;
}

export interface MarketPrice {
  id: string;
  recipeId: string;
  competitorName: string;
  price: number;
}

export interface CalculationContext {
  ingredients: Ingredient[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  fixedExpenses: FixedExpense[];
  settings: BusinessSettings;
  marketPrices?: MarketPrice[];
}

export interface CostBreakdown {
  recipeId: string;
  yieldQuantity: number;
  yieldUnit: Unit;
  materialBatch: number;
  laborBatch: number;
  fixedBatch: number;
  totalBatch: number;
  materialPerYieldUnit: number;
  laborPerYieldUnit: number;
  fixedPerYieldUnit: number;
  totalPerYieldUnit: number;
  sellingPrice: number | null;
  differencePerYieldUnit: number | null;
  marginOnPrice: number | null;
  markupOnCost: number | null;
}

export interface SalesGoal {
  unitsRequired: number;
  projectedRevenue: number;
  projectedMaterials: number;
  contributionPerUnit: number;
  monthlyTarget: number;
  // É uma simulação de um único produto, não um resultado realizado.
}

/* Exercita a função REAL de validação usada na restauração JSON do app.js.
   Node >= 20. Não mexe em IndexedDB nem em dados do utilizador. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {convertQuantity,calculateRecipePrice} from '../public/core/engine.js';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const match=src.match(/function validateImported\([\s\S]*?(?=\nfunction download\()/);
assert.ok(match,'Função validateImported não encontrada; reveja estrutura do app');
const requireNum=(v,label,{positive=false,integer=false}={})=>{const x=Number(String(v??'').trim().replace(',','.'));if(!Number.isFinite(x)||(positive?x<=0:x<0)||(integer&&!Number.isInteger(x)))throw Error(`${label}: valor inválido`);return x};
const collections=['ingredients','recipes','recipeItems','fixedExpenses','marketPrices'];
const sandbox={collections,requireNum,convertQuantity,calculateRecipePrice};vm.createContext(sandbox);vm.runInContext(match[0]+'\nthis.validateImported=validateImported;',sandbox);
const validate=sandbox.validateImported;
const seed=()=>({ingredients:[{id:'i',name:'Farinha',purchaseQuantity:1000,purchaseUnit:'g',purchasePrice:8}],recipes:[{id:'r',name:'Brownie',yieldQuantity:20,yieldUnit:'un',productionMinutes:90,sellingPrice:7}],recipeItems:[{id:'x',recipeId:'r',sourceType:'ingredient',sourceId:'i',quantity:200,unit:'g'}],fixedExpenses:[{id:'e',name:'Energia',monthlyAmount:100}],marketPrices:[{id:'m',recipeId:'r',competitorName:'Loja',price:9}],settings:{currency:'BRL',desiredMonthlySalary:3000,monthlyWorkHours:180,workDaysPerMonth:22,workHoursPerDay:8}});
const cases=[
  ['Backup íntegro',()=>assert.doesNotThrow(()=>validate(seed(),true))],
  ['Backup com medidas lineares',()=>{const d=seed();d.ingredients[0].purchaseUnit='m';d.ingredients[0].purchaseQuantity=2;d.recipeItems[0].unit='cm';d.recipeItems[0].quantity=50;assert.doesNotThrow(()=>validate(d,true))}],
  ['Coleção ausente',()=>{const d=seed();delete d.ingredients;assert.throws(()=>validate(d,true),/Coleção ausente/)}],
  ['IDs duplicados',()=>{const d=seed();d.ingredients.push({...d.ingredients[0]});assert.throws(()=>validate(d,true),/IDs inválidos/)}],
  ['Componente sem origem',()=>{const d=seed();d.recipeItems[0].sourceId='inexistente';assert.throws(()=>validate(d,true),/Referência/)}],
  ['Preço negativo',()=>{const d=seed();d.ingredients[0].purchasePrice=-20;assert.throws(()=>validate(d,true))}],
  ['Unidades incompatíveis',()=>{const d=seed();d.recipeItems[0].unit='ml';assert.throws(()=>validate(d,true),/incompatível/)}],
  ['Dependência circular rejeitada',()=>{const d=seed();d.recipeItems.push({id:'c',recipeId:'r',sourceType:'recipe',sourceId:'r',quantity:1,unit:'un'});assert.throws(()=>validate(d,true),/circular/)}],
  ['Moeda não reconhecida',()=>{const d=seed();d.settings.currency='XYZ';assert.throws(()=>validate(d,true),/Configurações/)}],
  ['Rendimento ausente é aceito para receita migrada',()=>{const d=seed();d.recipes[0].yieldQuantity=null;assert.doesNotThrow(()=>validate(d,true));assert.throws(()=>validate(d,false),/Rendimento ausente/)}],
  ['Formato de envelope do backup',()=>{const b={format:'atelie-backup',version:1,exportedAt:new Date().toISOString(),data:seed()};const re=JSON.parse(JSON.stringify(b));assert.deepEqual(re,b);validate(re.data,true)}]
];
let passed=0;for(const [name,fn] of cases){try{fn();passed++;console.log('PASS',name)}catch(e){console.error('FAIL',name,e.message)}}
console.log(`${passed}/${cases.length} testes de validação JSON`);process.exitCode=passed===cases.length?0:1;

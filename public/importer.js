/* Importação local dos DOIS modelos oficiais; não executa macros nem fórmulas. */
const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const PKG='http://schemas.openxmlformats.org/package/2006/relationships';
function elems(node,tag){return Array.from(node.getElementsByTagNameNS(NS,tag))}
function cellText(c,shared){
  const t=c.getAttribute('t'),v=elems(c,'v')[0]?.textContent;
  if(t==='s')return shared[Number(v)]??'';
  if(t==='inlineStr')return elems(c,'t').map(x=>x.textContent).join('');
  if(t==='e')return '';
  if(t==='b')return v==='1';
  if(v!==undefined){if(t==='str')return v;let n=Number(v);return Number.isFinite(n)&&v!==''?n:v}
  return '';
}
function xml(text){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('XML inválido na planilha');return doc}
function normalized(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function nval(v){if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string'||!v.trim())return null;const n=Number(v.replace(',','.'));return Number.isFinite(n)?n:null}
function isPositive(n){return n!==null&&n>0}
function refName(v){return normalized(v).replace(/\s*\((?:g|kg|ml|l|mm|cm|m|un|und|unid)\)\s*$/i,'').trim()}
function unitFromName(s){const m=String(s).match(/\((g|kg|ml|l|mm|cm|m|un|und|unid)\)\s*$/i);if(!m)return null;return ({und:'un',unid:'un'})[m[1].toLowerCase()]??m[1].toLowerCase()}
function sheetRows(doc,shared){const result=new Map(),formulas=new Map();for(const c of elems(doc,'c')){const r=c.getAttribute('r');if(!r)continue;result.set(r.toUpperCase(),cellText(c,shared));const f=elems(c,'f')[0];if(f)formulas.set(r.toUpperCase(),f.textContent||'')}return {at:(ref)=>result.get(ref)??'',formula:(ref)=>formulas.get(ref)??'',entries:()=>result.entries()}}
export async function parseLegacyWorkbook(file){
 if(!/\.(xlsx|xlsm)$/i.test(file.name))throw Error('Selecione um ficheiro .xlsx ou .xlsm');
 if(file.size>25*1024*1024)throw Error('O ficheiro ultrapassa o limite de 25 MB');
 if(typeof JSZip==='undefined')throw Error('Leitor de Excel não carregado');
 let zip;try{zip=await JSZip.loadAsync(await file.arrayBuffer())}catch{throw Error('O ficheiro não é um Excel válido')}
 const read=async path=>{const f=zip.file(path);if(!f)throw Error(`Parte obrigatória ausente: ${path}`);return xml(await f.async('string'))};
 const shared=[];
 if(zip.file('xl/sharedStrings.xml'))for(const si of elems(await read('xl/sharedStrings.xml'),'si'))shared.push(elems(si,'t').map(x=>x.textContent).join(''));
 const workbook=await read('xl/workbook.xml');const rels=xml(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
 const paths=new Map(Array.from(rels.getElementsByTagNameNS(PKG,'Relationship')).map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
 const sheets=new Map();
 for(const s of elems(workbook,'sheet')){
  const id=s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  let p=paths.get(id);if(!p)continue;
  p=p.startsWith('/')?p.slice(1):(p.startsWith('xl/')?p:'xl/'+p.replace(/^\.\//,''));
  if(p.includes('..'))throw Error('Caminho inválido na planilha');
  sheets.set(s.getAttribute('name'),sheetRows(await read(p),shared));
 }
 const officialNew=sheets.has('BANCO DE DADOS Turbinado')&&sheets.has('Modelo');
 const officialOld=sheets.has('Ingredientes')&&sheets.has('Modelo');
 if(!officialNew&&!officialOld)throw Error('Não é um dos dois modelos oficiais reconhecidos');
 const model=officialNew?'Turbinada .xlsm':'Anterior .xlsx';
 const bank=sheets.get(officialNew?'BANCO DE DADOS Turbinado':'Ingredientes');
 const notes=[];const ingredients=[],recipes=[],recipeItems=[],byName=new Map(),recipeMap=new Map(),deferred=[];
 const warn=(x)=>{if(notes.length<250)notes.push(x)};
 const makeid=(p,i)=>`${p}-${i}`;
 let duplicateCount=0;
 for(let row=officialNew?4:3;row<=500;row++){
  const raw=String(bank.at(`B${row}`)??'').trim();if(!raw)continue;
  const qty=nval(bank.at(`C${row}`)),price=nval(bank.at(`D${row}`));
  // Entradas criadas pelas macros para reutilizar receitas não são ingredientes de compra.
  if(/\breceita\b/i.test(raw)||bank.formula(`D${row}`)){
    deferred.push({row,raw,qty,price,formula:bank.formula(`D${row}`)});continue;
  }
  if(!isPositive(qty)||price===null||price<0){warn(`Base, linha ${row}: «${raw}» sem quantidade/preço válidos; não importado.`);continue}
  const key=normalized(raw);
  if(byName.has(key)){duplicateCount++;warn(`Base, linha ${row}: «${raw}» repetido; mantido o primeiro cadastro.`);continue}
  let unit=unitFromName(raw);
  if(!unit){
    unit='g';warn(`Base, linha ${row}: «${raw}» sem unidade explícita; assumido g. Confira depois.`);
  }
  if(unit==='un'&&!Number.isInteger(qty)){warn(`Base, linha ${row}: «${raw}» tem quantidade fracionada em unidades; não importado.`);continue}
  const obj={id:makeid('ing',row),name:refName(raw),purchaseQuantity:qty,purchaseUnit:unit,purchasePrice:price};
  ingredients.push(obj);byName.set(key,obj);
 }
 const recipeSheets=[];
 // O título em E4 pode ser genérico ou repetido. A aba identifica a receita específica.
 const candidates=[...sheets.entries()].filter(([name])=>!['Modelo','Ingredientes','BANCO DE DADOS Turbinado'].includes(name));
 const titleCounts=new Map();
 for(const [sheetName,s] of candidates){
  const key=normalized(s.at('E4'));if(key)titleCounts.set(key,(titleCounts.get(key)||0)+1);
 }
 for(const [sheetName,s] of candidates){
  const rawTitle=String(s.at('E4')??'').replace(/\\s+/g,' ').trim();
  const duplicateTitle=rawTitle&&titleCounts.get(normalized(rawTitle))>1;
  const name=(!rawTitle||duplicateTitle)?sheetName:rawTitle;
  if(duplicateTitle&&normalized(rawTitle)!==normalized(sheetName))warn(`Receita «${sheetName}»: título genérico «${rawTitle}» substituído pelo nome da aba.`);
  const hasMaterials=Array.from({length:17},(_,i)=>String(s.at(`B${i+5}`)||'').trim()).some(Boolean);
  if(!hasMaterials){warn(`Receita «${name}» sem componentes preenchidos; não importada.`);continue}
  const yieldQuantity=nval(s.at('J4'));const productionHours=nval(s.at('J6'));const sellingPrice=nval(s.at('P6'));
  const recipe={id:makeid('rec',recipes.length+1),name,yieldQuantity:isPositive(yieldQuantity)?yieldQuantity:null,yieldUnit:'un',productionMinutes:productionHours!==null&&productionHours>=0?productionHours*60:null,sellingPrice:sellingPrice!==null&&sellingPrice>=0?sellingPrice:null};
  if(recipe.yieldQuantity===null)warn(`Receita «${name}»: rendimento vazio; preencha-o antes de calcular.`);
  if(recipe.productionMinutes===null)warn(`Receita «${name}»: tempo de produção vazio; preencha-o antes de calcular.`);
  // A unidade do rendimento não está codificada no modelo Excel; 'un' é provisório.
  warn(`Receita «${name}»: confirme a unidade de rendimento (un/g/ml) após importar.`);
  if(sellingPrice!==null&&sellingPrice<0)warn(`Receita «${name}»: preço de venda negativo ignorado.`);
  recipes.push(recipe);recipeMap.set(normalized(name),recipe);
  // A aba funciona como identificador adicional, sem confundir títulos genéricos.
  if(normalized(sheetName)!==normalized(name))recipeMap.set(normalized(sheetName),recipe);
  recipeSheets.push({sheetName,s,recipe});
 }
 // Fontes ligadas a receitas devem sobrepor nomes de ingredientes, quando identificadas.
 const recipeAlias=new Map(recipeMap);
 for(const d of deferred){
  const k=normalized(d.raw);const sheetMatch=d.formula?.match(/'?([^'!]+)'?![A-Z]+\d+/);const fromSheet=sheetMatch?recipeMap.get(normalized(sheetMatch[1])):null;const matches=fromSheet?[[normalized(fromSheet.name),fromSheet]]:[...recipeMap.entries()].filter(([name])=>k===name||k.startsWith(name+' ')||k.startsWith(name+' receita'));
  if(matches.length===1)recipeAlias.set(k,matches[0][1]);
  else warn(`Base, linha ${d.row}: «${d.raw}» parece receita reutilizada, mas não foi identificada com segurança.`);
 }
 for(const {s,recipe} of recipeSheets){for(let row=5;row<=21;row++){
   const raw=String(s.at(`B${row}`)||'').trim();if(!raw)continue;
   const quantity=nval(s.at(`E${row}`));if(!isPositive(quantity)){warn(`«${recipe.name}», linha ${row}: «${raw}» sem quantidade positiva; componente ignorado.`);continue}
   const key=normalized(raw), rec=recipeAlias.get(key), ing=byName.get(key);
   let source=rec||ing,sourceType=rec?'recipe':'ingredient';
   if(!source){warn(`«${recipe.name}», linha ${row}: componente «${raw}» não encontrado na base; ignorado.`);continue}
   let unit=unitFromName(raw)|| (sourceType==='recipe'?source.yieldUnit:source.purchaseUnit);
   if(unit==='un'&&!Number.isInteger(quantity)){warn(`«${recipe.name}», linha ${row}: quantidade fracionária em unidades; ignorado.`);continue}
   recipeItems.push({id:makeid('item',recipeItems.length+1),recipeId:recipe.id,sourceType,sourceId:source.id,quantity,unit});
  }}
 return {model,ingredients,recipes,recipeItems,notes,duplicateCount};
}

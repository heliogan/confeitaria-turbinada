import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPreparation,insertMarkdown} from '../public/preparation-markdown.js';

test('Renderiza títulos, negrito, itálico e listas',()=>{
  const html=renderPreparation('## Preparação\n\n1. Misture **chocolate**\n2. Adicione *ovos*\n\n- Forno quente');
  assert.match(html,/<h3>Preparação<\/h3>/);
  assert.match(html,/<ol>/);
  assert.match(html,/<strong>chocolate<\/strong>/);
  assert.match(html,/<em>ovos<\/em>/);
  assert.match(html,/<ul>/);
});
test('Não interpreta HTML ou atributos perigosos',()=>{
  const html=renderPreparation('<script>alert(1)</script>\n\n- <img src=x onerror=alert(1)>');
  assert.doesNotMatch(html,/<script\b|<img\b/i);
  assert.match(html,/&lt;script&gt;/);
});
test('Texto vazio produz saída vazia',()=>assert.equal(renderPreparation('   '),''));
test('Botões envolvem a seleção e mantêm a posição',()=>{
  const r=insertMarkdown('Derreta chocolate',8,17,'bold');
  assert.equal(r.text,'Derreta **chocolate**');
  assert.equal(r.selectionStart,10);
  assert.equal(r.selectionEnd,19);
});
test('Listas e títulos podem ser inseridos sem seleção',()=>{
  assert.equal(insertMarkdown('',0,0,'numbered').text,'1. Passo');
  assert.equal(insertMarkdown('',0,0,'heading').text,'## Título');
});

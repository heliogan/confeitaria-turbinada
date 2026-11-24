"""Testes E2E locais, em Chromium isolado. Não toca no perfil do navegador do usuário.
Executar: python test/browser_qa.py
Dependências de QA: playwright Python + Chromium local.
"""
from pathlib import Path
import json, subprocess, time, socket, tempfile, contextlib
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
FILES=Path('/mnt/data')
PORT=18743
URL=f'http://127.0.0.1:{PORT}'
results=[]

def check(name,fn):
    try:
        fn();results.append((name,'OK',''));print('PASS',name)
    except Exception as exc:
        results.append((name,'FALHOU',str(exc)));print('FAIL',name,str(exc)[:250])

def get_data(page):
    return page.evaluate('''async () => new Promise((resolve,reject)=>{const r=indexedDB.open('atelie-precificacao',1);r.onsuccess=()=>{const t=r.result.transaction('state');const q=t.objectStore('state').get('main');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)};r.onerror=()=>reject(r.error)})''')

def open_data(page):
    page.locator('#nav [data-page="data"]').click()

def import_excel(page,filename):
    open_data(page)
    page.locator('#legacy-input').set_input_files(FILES/filename)
    page.locator('#legacy-preview button[data-action="confirm-legacy"]').wait_for(timeout=20000)
    return page.locator('#legacy-preview').inner_text()

def apply_import(page):
    page.once('dialog',lambda d:d.accept())
    page.locator('[data-action="confirm-legacy"]').click()
    page.get_by_text('Planilha importada.',exact=False).wait_for(timeout=10000)

def restore_file(page,filename,accept=True):
    open_data(page)
    page.once('dialog',lambda d:d.accept() if accept else d.dismiss())
    page.locator('#restore-input').set_input_files(filename)

def test_import(page,filename,label):
    view=import_excel(page,filename)
    assert label in view,view[:500]
    assert 'ingredientes' in view and 'receitas' in view
    apply_import(page)
    data=get_data(page)
    assert data['ingredients'] and data['recipes'] and data['recipeItems']
    ids={i['id'] for i in data['ingredients']}
    recs={r['id'] for r in data['recipes']}
    for item in data['recipeItems']:
        assert item['recipeId'] in recs
        assert item['sourceId'] in (recs if item['sourceType']=='recipe' else ids)
    assert all((r['productionMinutes'] is None or r['productionMinutes']>=0) for r in data['recipes'])
    return data

def main():
  with socket.socket() as s:
    assert s.connect_ex(('127.0.0.1',PORT))!=0, 'Porta QA já ocupada'
  server=subprocess.Popen(['python','-m','http.server',str(PORT),'--bind','127.0.0.1','--directory',str(ROOT/'public')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  try:
    time.sleep(.8)
    with sync_playwright() as p:
      browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
      ctx=browser.new_context(accept_downloads=True,service_workers='block')
      page=ctx.new_page()
      errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      page.goto(URL,wait_until='networkidle')
      check('Inicialização sem erros JS',lambda: (page.locator('#content h1').wait_for(), not errors or (_ for _ in ()).throw(AssertionError(errors))))
      check('IndexedDB criada',lambda: assert_keys(get_data(page),['settings','ingredients','recipes','recipeItems','marketPrices','fixedExpenses']))
      old='Precificação_Atelieescoladeconfeitaria.xlsx'
      new='Nova Planilha Preço Turbinado VFF.xlsm'
      captured={}
      def first():captured['old']=test_import(page,old,'Anterior')
      check('Importar XLSX anterior e verificar vínculos',first)
      if 'old' in captured:
        def pers():
          prior=get_data(page);page.reload(wait_until='networkidle');assert get_data(page)==prior
        check('Persistência após recarregar página',pers)
        def backup():
          open_data(page)
          with page.expect_download() as dl:page.locator('[data-action="export-backup"]').click()
          path=Path(tempfile.mkdtemp())/'backup.json';dl.value.save_as(path)
          obj=json.loads(path.read_text())
          assert obj['format']=='atelie-backup' and obj['version']==1
          assert obj['data']==get_data(page)
          captured['backup_path']=path;captured['backup']=obj
        check('Exportar backup completo com dados íntegros',backup)
        if 'backup_path' in captured:
          def roundtrip():
            restore_file(page,captured['backup_path'])
            page.wait_for_timeout(200)
            assert get_data(page)==captured['backup']['data']
          check('Restaurar backup e comparar todos os dados',roundtrip)
          def reject():
            obj=json.loads(captured['backup_path'].read_text())
            obj['data']['recipeItems'][0]['sourceId']='inexistente'
            path=captured['backup_path'].with_name('backup-invalido.json');path.write_text(json.dumps(obj))
            before=get_data(page)
            restore_file(page,path)
            page.wait_for_timeout(200)
            assert get_data(page)==before
          check('Backup com referência inválida não altera base',reject)
          def cancel():
            before=get_data(page)
            restore_file(page,captured['backup_path'],accept=False)
            page.wait_for_timeout(200)
            assert get_data(page)==before
          check('Cancelar restauração preserva dados',cancel)
          def erase_restore():
            open_data(page)
            page.once('dialog',lambda d:d.accept())
            page.locator('[data-action="clear-all"]').click()
            assert get_data(page)['recipes']==[]
            restore_file(page,captured['backup_path'])
            page.wait_for_timeout(200)
            assert get_data(page)==captured['backup']['data']
          check('Recuperação integral após apagar base',erase_restore)
      def second():captured['new']=test_import(page,new,'Turbinada')
      check('Importar XLSM nova e verificar vínculos',second)
      if 'new' in captured:
        def stale():
          d=captured['new'];assert d['recipes'] and d['ingredients'];assert len(d['marketPrices'])==0
          assert d['settings']['desiredMonthlySalary']==captured['old']['settings']['desiredMonthlySalary']
        check('Importar preserva configurações, substitui catálogos',stale)
      check('Sem erros JavaScript no navegador',lambda: assert_empty(errors))
      browser.close()
  finally:
    server.terminate();server.wait(timeout=5)
  out=ROOT/'TEST_REPORT.json';out.write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print('\nRESULTADO',sum(x[1]=='OK' for x in results),'/',len(results))
  return all(x[1]=='OK' for x in results)

def assert_keys(obj,ks):
  assert all(k in obj for k in ks),list(obj)
def assert_empty(items):
  assert not items,items
if __name__=='__main__':raise SystemExit(0 if main() else 1)

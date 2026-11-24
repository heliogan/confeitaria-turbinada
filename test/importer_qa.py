"""Executa importador JS real com DOMParser+JSZip num Chromium isolado.
Não depende de servidor e não altera o navegador do usuário.
"""
import base64, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
INPUT=Path('/mnt/data')

def main():
    results=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page()
        page.add_script_tag(content=(ROOT/'public/vendor/jszip.min.js').read_text())
        code=base64.b64encode((ROOT/'public/importer.js').read_bytes()).decode()
        page.evaluate('''async code => {const m=await import('data:text/javascript;base64,'+code);window.parseLegacyWorkbook=m.parseLegacyWorkbook}''',code)
        for filename,expected in [('Precificação_Atelieescoladeconfeitaria.xlsx','Anterior'),('Nova Planilha Preço Turbinado VFF.xlsm','Turbinada')]:
            b64=base64.b64encode((INPUT/filename).read_bytes()).decode()
            out=page.evaluate('''async ({bytes,name})=>{
                const bin=atob(bytes), arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
                const file=new File([arr],name);return await window.parseLegacyWorkbook(file);
            }''',{'bytes':b64,'name':filename})
            assert expected in out['model']
            assert out['ingredients'] and out['recipes'] and out['recipeItems']
            if expected=='Anterior':
                names=[x['name'] for x in out['recipes']]
                for required in ('Fatia Princesa','Fatia Maracujá','Fatia Red Velvet','Tortinha de Limão','Tortinha de Maracujá','Massa Baunilha','Massa Chocolate','Massa Red Velvet'):
                    assert required in names, (required,names)
                assert len(names)==len(set(names)), 'Nomes duplicados de receitas: '+str(names)
                print('PASS nomes específicos e sem duplicação',len(names))
            ingredients={x['id'] for x in out['ingredients']};recipes={x['id'] for x in out['recipes']}
            missing=[x for x in out['recipeItems'] if x['recipeId'] not in recipes or x['sourceId'] not in (recipes if x['sourceType']=='recipe' else ingredients)]
            assert not missing,missing
            results.append({'model':expected,'ingredients':len(ingredients),'recipes':len(recipes),'items':len(out['recipeItems']),'recipeRefs':sum(x['sourceType']=='recipe' for x in out['recipeItems']),'warnings':len(out['notes'])})
            print('PASS',expected,results[-1])
        invalid=page.evaluate('''async()=>{try {await window.parseLegacyWorkbook(new File(['garbage'],'invalid.xlsx'));return false}catch(e){return true}}''')
        assert invalid
        print('PASS rejeita Excel inválido')
        badext=page.evaluate('''async()=>{try {await window.parseLegacyWorkbook(new File(['garbage'],'invalido.txt'));return false}catch(e){return true}}''')
        assert badext
        print('PASS rejeita extensão inválida')
        browser.close()
    (ROOT/'IMPORTER_TEST_REPORT.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))

if __name__=='__main__':main()

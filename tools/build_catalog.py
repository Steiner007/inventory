import openpyxl, json, re
wb=openpyxl.load_workbook('data/Plumbing_Inventory_and_App_Brief.xlsx',data_only=True)
ws=wb['Inventory']
rows=list(ws.iter_rows(min_row=2,values_only=True))
SZ=r'(?:\d+-\d+/\d+|\d+/\d+|\d+)'
lead=re.compile(r'^('+SZ+r'(?: x '+SZ+r')?)\s+(?!in\b|ft\b)')
trail=re.compile(r'\s('+SZ+r')$')
def mat_sch(cat,name):
    n=name.lower(); m='';s=''
    if cat.startswith('PVC DWV'): m,s='PVC','Sch 40'
    elif cat.startswith('PVC Sch 30'): m,s='PVC','Sch 30'
    elif cat=='Copper press':
        m='Copper'
        if 'type l' in n: s='Type L'
        if 'type m' in n: s='Type M'
    elif cat.startswith('Uponor'): m='PEX'
    elif cat.startswith('Black gas'): m='Black steel'
    else:
        for k,v in [('pvc','PVC'),('cast iron','Cast iron'),('copper','Copper'),('brass','Brass'),('sharkbite','Push-to-connect'),('metal','Metal'),('tubular','Plastic tubular'),('pex','PEX')]:
            if k in n: m=v;break
    if cat.startswith('Uponor') and 'lead-free brass' in n: m='PEX'  # fitting body noted in name
    return m,s
out=[];cats=[]
for r in rows:
    cat,size,name,notes=r[0],r[1],r[2],r[3]
    if not cat: continue
    if cat not in cats: cats.append(cat)
    derived=False
    if not size:
        mm=lead.match(name) or (trail.search(name) if cat not in('Tools and equipment',) or name.startswith(('Press jaws','Expansion head')) else None)
        if mm and not re.search(r'\d+ in$',name): size=mm.group(1); derived=True
    m,s=mat_sch(cat,name)
    out.append([cats.index(cat),size or '',name,notes or '',m,s,1 if derived else 0])
json.dump({'cats':cats,'items':out},open('data/catalog.json','w'),separators=(',',':'))
print(len(out),len(json.dumps(out)))
for o in out:
    if o[6]: print(o[1],'|',o[2])

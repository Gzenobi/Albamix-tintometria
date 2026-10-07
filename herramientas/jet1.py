"""Minimal reader for Jet 1.x (Access 1.x / VB3) .mdb files with damaged header."""
import sys,struct,csv,datetime
P=2048
def u16(b,o): return int.from_bytes(b[o:o+2],'little')
def u32(b,o): return int.from_bytes(b[o:o+4],'little')
def page_rows(pg):
    n=u16(pg,8)
    offs=[u16(pg,0x14+2*i) for i in range(n)]
    starts=sorted({o&0x7ff for o in offs if o&0x7ff})
    out=[]
    for o in offs:
        if not (o & 0x1000): continue          # live row flag
        s=o&0x7ff
        nxt=[x for x in starts if x>s]
        e=nxt[0] if nxt else P
        out.append(pg[s:e])
    return out
def table_rows(d,tdef):
    for n in range(len(d)//P):
        pg=d[n*P:(n+1)*P]
        if pg[0]==6 and u32(pg,4)==tdef:
            for r in page_rows(pg): yield n,r
def parse(r,cols):
    """cols: list of (name, kind, size, typ) ; kind 'f'=fixed idx order, 'v'=var idx order"""
    L=u16(r,0); r=r[:L]
    nf,nv=r[2],r[3]
    mlen=max(1,(nf+7)//8)  # null mask sized by fixed-column count
    numvar=r[L-mlen-1]
    offs=[r[L-mlen-2-i] for i in range(numvar)]  # off0,off1...
    eod=r[L-mlen-2-numvar]
    pos=4; out={}
    fixed=[c for c in cols if c[1]=='f']; var=[c for c in cols if c[1]=='v']
    for name,k,size,typ in fixed:
        out[name]=conv(r[pos:pos+size],typ); pos+=size
    bounds=offs+[eod]
    for i,(name,k,size,typ) in enumerate(var):
        if i<numvar: out[name]=conv(r[bounds[i]:bounds[i+1]],typ)
        else: out[name]=None
    return out
def conv(b,typ):
    if typ==10: return b.decode('cp1252').rstrip()
    if not b: return None
    if typ==3: return struct.unpack('<h',b)[0]
    if typ==4: return struct.unpack('<i',b)[0]
    if typ==7: return struct.unpack('<d',b)[0]
    if typ==8:
        v=struct.unpack('<d',b)[0]
        return (datetime.datetime(1899,12,30)+datetime.timedelta(days=v)).strftime('%Y-%m-%d')
    return b.hex()
SCHEMAS={
 'albamix':{
  'FormulasC':(18,[('ID','f',4,4),('CODIGO','f',4,4),('NOMBRE','v',60,10),('OBS','v',255,10),('FECHA','v',8,8)]),
  'FormulasCap':(214,[('ID','f',4,4),('CAPA','f',8,7),('UNIDAD','v',1,10)]),
  'FormulasR':(216,[('ID','f',4,4),('LINEA','f',2,3),('COMP','f',4,4),('CANT','f',8,7)]),
 },
 'personal':{
  'P_FormulasC':(18,[('ID','f',4,4),('CODIGO','f',4,4),('NOMBRE','v',60,10),('OBS','v',255,10),('FECHA','v',8,8)]),
  'P_FormulasCap':(21,[('ID','f',4,4),('CAPA','f',8,7),('UNIDAD','v',1,10)]),
  'P_FormulasR':(23,[('ID','f',4,4),('LINEA','f',2,3),('COMP','f',4,4),('CANT','f',8,7)]),
  'P_clave':(36,[('clave','v',20,10)]),
 },
 'precios':{'Componentes':(18,[('COMP','f',4,4),('PE','f',8,7),('PRECIO1','f',8,7),('CAPA1','f',8,7),('PRECIO2','f',8,7),('CAPA2','f',8,7),('NOMBRE','v',60,10),('TIPO','v',1,10),('UNIDAD','v',1,10)])},
 'bonifica':{'Componentes':(18,[('COMP','f',4,4),('BONIF','f',8,7)])},
}
if __name__=='__main__':
    src,key,outdir=sys.argv[1],sys.argv[2],sys.argv[3]
    d=open(src,'rb').read()
    for t,(tdef,cols) in SCHEMAS[key].items():
        rows=[parse(r,cols) for _,r in table_rows(d,tdef)]
        with open(f'{outdir}/{t}.csv','w',newline='',encoding='utf-8') as f:
            w=csv.DictWriter(f,[c[0] for c in cols]); w.writeheader(); w.writerows(rows)
        print(t,len(rows))

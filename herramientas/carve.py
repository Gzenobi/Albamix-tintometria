"""Carve (live + deleted) FormulasR/FormulasC rows from raw Jet1 bytes by signature."""
import sys,re,struct,csv,datetime
d=open(sys.argv[1],'rb').read(); out=sys.argv[2]
R=set()
for m in re.finditer(rb'\x19\x00\x04\x00(.{4})(.{2})(.{4})(.{8})\x16\x00\x0f',d,re.S):
    i,l,c,q=struct.unpack('<ihid',b''.join(m.groups()))
    if 0<i<10**6 and 0<l<20 and 10**6<c<10**7 and 0<q<=1000: R.add((i,l,c,round(q,4)))
C={}
for m in re.finditer(rb'(.)\x00\x02\x03(.{4})(.{4})',d,re.S):
    s=m.start(); L=d[s]; r=d[s:s+L]
    if len(r)<L or L<20: continue
    i,code=struct.unpack('<ii',r[4:12])
    if not(0<i<10**6 and 0<code<10**6): continue
    try:
        eod,o2,o1,o0,nv=r[L-6],r[L-5],r[L-4],r[L-3],r[L-2]
        if nv!=3 or not(12==o0<=o1<=o2<=eod<=L-6): continue
        nom=r[o0:o1].decode('cp1252').rstrip(); obs=r[o1:o2].decode('cp1252').rstrip()
        fe=''
        if eod-o2==8:
            v=struct.unpack('<d',r[o2:eod])[0]
            if 20000<v<60000: fe=(datetime.datetime(1899,12,30)+datetime.timedelta(days=v)).strftime('%Y-%m-%d')
        C.setdefault(i,(i,code,nom,obs,fe))
    except Exception: pass
with open(out+'_R.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['ID','LINEA','COMP','CANT']); w.writerows(sorted(R))
with open(out+'_C.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['ID','CODIGO','NOMBRE','OBS','FECHA']); w.writerows(sorted(C.values()))
print(sys.argv[1],'R',len(R),'C',len(C))

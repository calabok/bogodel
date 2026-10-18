import json,sys
d=json.loads(open(sys.argv[1]).readline())
for k,v in d.items():
    print('==',k, '(win / death)' if k=='road' else '(win / hpLost)')
    cls=list(next(iter(v.values())).keys())
    print('L   '+' '.join(f'{c[:9]:>11}' for c in cls)+'   spread')
    for L,row in v.items():
        ws=[row[c]['win'] for c in cls]
        print(f'{L:<3} '+' '.join(f"{row[c]['win']:.2f}/{row[c].get('death',row[c].get('hpLost')):.2f}".rjust(11) for c in cls)+f'   {max(ws)-min(ws):.2f} avg {sum(ws)/len(ws):.2f}')

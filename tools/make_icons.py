from PIL import Image, ImageDraw, ImageFont, ImageFilter
F='/usr/share/fonts/truetype/sand-box/google/Noto Sans Symbols/NotoSansSymbols-VariableFont_wght.ttf'
def make(size, maskable=False, path=''):
    S=size*4
    im=Image.new('RGBA',(S,S),(0,0,0,0))
    bg=Image.new('RGBA',(S,S))
    d=ImageDraw.Draw(bg)
    for y in range(S):  # radial-ish vertical gradient
        t=y/S; c=(int(59*(1-t)+20*t),int(44*(1-t)+18*t),int(102*(1-t)+43*t),255); d.line([(0,y),(S,y)],fill=c)
    mask=Image.new('L',(S,S),0); md=ImageDraw.Draw(mask)
    if maskable: md.rectangle([0,0,S,S],fill=255)
    else: md.rounded_rectangle([0,0,S-1,S-1],radius=int(S*.22),fill=255)
    im.paste(bg,(0,0),mask)
    d=ImageDraw.Draw(im)
    if not maskable:
        w=int(S*.025); d.rounded_rectangle([w,w,S-1-w,S-1-w],radius=int(S*.2),outline=(201,150,43,255),width=w)
    scale=.5 if maskable else .62
    ft=ImageFont.truetype(F,int(S*scale))
    try: ft.set_variation_by_name('Bold')
    except Exception: pass
    bb=d.textbbox((0,0),'⚜',font=ft); tw,th=bb[2]-bb[0],bb[3]-bb[1]
    x=(S-tw)/2-bb[0]; y=(S-th)/2-bb[1]
    glow=Image.new('RGBA',(S,S),(0,0,0,0)); gd=ImageDraw.Draw(glow); gd.text((x,y),'⚜',font=ft,fill=(255,210,110,170))
    glow=glow.filter(ImageFilter.GaussianBlur(S*.03)); im=Image.alpha_composite(im,glow); d=ImageDraw.Draw(im)
    d.text((x,y+S*.012),'⚜',font=ft,fill=(90,55,10,255))
    d.text((x,y),'⚜',font=ft,fill=(232,192,99,255))
    im=im.resize((size,size),Image.LANCZOS)
    if path.endswith('apple-touch-icon.png'):
        flat=Image.new('RGB',(size,size),(28,22,56)); flat.paste(im,(0,0),im); im=flat
    im.save(path)
make(192,False,'site/icons/icon-192.png'); make(512,False,'site/icons/icon-512.png')
make(192,True,'site/icons/maskable-192.png'); make(512,True,'site/icons/maskable-512.png')
make(180,True,'site/icons/apple-touch-icon.png'); make(32,False,'site/icons/favicon-32.png')

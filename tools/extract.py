import os, numpy as np
from PIL import Image
from scipy import ndimage
from rembg import remove, new_session
OUT='../public/assets'
for d in ['characters','enemies','backgrounds','ui']: os.makedirs(f'{OUT}/{d}',exist_ok=True)
im=Image.open('src/reference.png').convert('RGB')
sess=new_session('isnet-general-use')

def largest(img, keep=1, minfrac=0.02):
    a=np.array(img); al=a[:,:,3]>20
    lab,n=ndimage.label(al)
    if n==0: return img
    sizes=ndimage.sum(al,lab,range(1,n+1))
    ok=[i+1 for i,s in enumerate(sizes) if s>=sizes.max()*minfrac]
    mask=np.isin(lab,ok)
    a[:,:,3]=np.where(mask,a[:,:,3],0)
    return Image.fromarray(a)

def trim(img):
    bb=img.getbbox(); return img.crop(bb) if bb else img

# hero heads (from the head pipeline)
for n in ['dau-dau','bap','shu-shu']:
    h=trim(largest(Image.open(f'out/head_{n}.png'),minfrac=0.05))
    h.save(f'{OUT}/characters/{n}-head.png')
# select portraits (keep panel background)
for n,(x0,x1) in {'dau-dau':(619,724),'bap':(735,847),'shu-shu':(859,968)}.items():
    p=im.crop((x0,64,x1,226)).resize(((x1-x0)*2,324),Image.LANCZOS)
    p.save(f'{OUT}/characters/{n}-portrait.png')
# enemy heads: segment each cell, then cut head box (orig coords)
cells={'thug':((1157,497,1243,585),(1188,500,1228,543)),
 'swat':((1250,497,1335,585),(1268,497,1310,538)),
 'punk':((1343,497,1428,585),(1370,496,1408,543)),
 'masked':((1436,497,1522,585),(1462,499,1502,540)),
 'robot':((1157,607,1243,695),(1188,614,1222,647)),
 'sniper':((1250,607,1335,695),(1265,612,1300,651)),
 'boss':((1436,607,1522,695),(1464,609,1499,650))}
S=4
for n,(cell,head) in cells.items():
    c=im.crop(cell).resize(((cell[2]-cell[0])*S,(cell[3]-cell[1])*S),Image.LANCZOS)
    r=remove(c,session=sess)
    hx0=(head[0]-cell[0])*S; hy0=(head[1]-cell[1])*S; hx1=(head[2]-cell[0])*S; hy1=(head[3]-cell[1])*S
    h=r.crop((max(0,hx0),max(0,hy0),hx1,hy1))
    a=np.array(h).astype(float); H,W=a.shape[:2]
    yy,xx=np.mgrid[0:H,0:W]
    d=((xx-W/2)/(W*0.52))**2+((yy-H*0.45)/(H*0.56))**2
    m=np.clip((1-d)*12,0,1); m[yy<H*0.5]=np.maximum(m[yy<H*0.5],0)  # ellipse
    a[:,:,3]*=m
    out=trim(largest(Image.fromarray(a.astype('uint8')),minfrac=0.1))
    out.save(f'{OUT}/enemies/{n}-head.png')
    r.save(f'out/cell_{n}.png')
# stage postcards
tiles=[(657,500,890,632),(901,500,1130,632),(657,664,890,796),(901,664,1130,796),(657,828,890,960),(901,828,1130,960)]
names=['city','port','factory','ice','subway','tower']
for n,t in zip(names,tiles):
    im.crop(t).resize(((t[2]-t[0])*2,(t[3]-t[1])*2),Image.LANCZOS).save(f'{OUT}/backgrounds/card-{n}.jpg',quality=88)
print('done')

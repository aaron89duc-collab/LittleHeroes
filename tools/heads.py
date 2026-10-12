from PIL import Image, ImageFilter
import numpy as np
r=Image.open('out/poster_full_isnet-general-use.png')
a=np.array(r).astype(float)
H,W=a.shape[:2]
yy,xx=np.mgrid[0:H,0:W]
spec={'dau-dau':dict(box=(95,40,375,356),yl=236,c=(236,242),rx=108,ry=110),
 'bap':dict(box=(398,20,772,348),yl=300,c=(597,252),rx=108,ry=93),
 'shu-shu':dict(box=(768,40,1118,342),yl=298,c=(960,250),rx=98,ry=87)}
for n,s in spec.items():
    cx,cy=s['c']
    d=((xx-cx)/s['rx'])**2+((yy-cy)/s['ry'])**2
    m=np.clip((1.0-d)*40,0,1)
    m=np.maximum(m,np.clip((s['yl']-yy)/28.0,0,1))
    if n=='dau-dau': m[(yy<60)&(xx>150)&(xx<300)]=0
    b=a.copy(); b[:,:,3]*=m
    x0,y0,x1,y1=s['box']
    c=b[y0:y1,x0:x1]; c[:,:,3][c[:,:,3]<30]=0
    Image.fromarray(c.astype('uint8')).save('out/head_'+n+'.png')
ims=[Image.open('out/head_'+n+'.png') for n in spec]
bg=Image.new('RGBA',(1100,340),(40,200,80,255));x=0
for i in ims: bg.alpha_composite(i,(x,0)); x+=i.width+10
bg.save('/tmp/claude-0/heads.png')

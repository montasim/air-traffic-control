"""Regenerate the social card from the project root (Python 3 + Pillow required)."""
from PIL import Image,ImageDraw,ImageFont
s=2
im=Image.new('RGB',(1200*s,630*s),'#254039');d=ImageDraw.Draw(im)
def box(xy,fill,r=0,outline=None,width=1):d.rounded_rectangle(tuple(int(x*s) for x in xy),radius=r*s,fill=fill,outline=outline,width=width*s)
def text(x,y,t,size,color,font='BarlowCondensed-Bold.woff2'):
 f=ImageFont.truetype('public/fonts/'+font,size*s);d.text((x*s,y*s),t,font=f,fill=color)
def line(xy,color,width):d.line([(x*s,y*s) for x,y in xy],fill=color,width=width*s)
cream='#fff5df';gold='#ebaa44';cyan='#8bd1d2'
box((28,28,1172,602),None,24,'#527064',1)
text(72, 58,'DRAW. LAND. REPEAT.',19,cyan,'AtkinsonHyperlegible-Regular.woff2')
text(68,107,'Air Traffic',104,cream)
text(68,214,'Control',104,gold)
line([(74,353),(143,353)],gold,5)
text(72,382,'Draw flight paths. Land aircraft.',25,cream,'AtkinsonHyperlegible-Regular.woff2')
text(72,421,'Avoid collisions.',25,cream,'AtkinsonHyperlegible-Regular.woff2')
text(72,532,'9 AIRFIELDS   /   3 DIFFICULTIES',18,cyan,'AtkinsonHyperlegible-Regular.woff2')
# Original simplified runway and route, using the game's palette.
box((723,116,1094,188),'#365a55',9,cream,3)
box((735,128,743,176),cyan)
box((1074,128,1082,176),cyan)
for x in range(767,1050, 50):line([(x,152),(x+24,152)],cream,3)
pts=[(707,468),(754,454),(795,426),(829,390),(853,349),(869,302),(876,246),(879,188)]
for i in range(len(pts)-1):
 a,b=pts[i],pts[i+1]
 for j in (0,.55):
  c=(a[0]+(b[0]-a[0])*j,a[1]+(b[1]-a[1])*j);e=(a[0]+(b[0]-a[0])*(j+.28),a[1]+(b[1]-a[1])*(j+.28));line([c,e],gold,4)
# Aircraft points forward to the right.
poly=[(641,450),(671,450),(662,422),(674,418),(695,450),(723,450),(738,460),(723,470),(695,470),(674,502),(662,498),(671,470),(641,470),(632,485),(623,483),(629,460),(623,437),(632,435)]
d.polygon([(x*s,y*s) for x,y in poly],fill=cream,outline='#173733',width=4*s)
line([(642,460),(721,460)],gold,6)
text(955,533,'CLEARED TO LAND',15,cream,'AtkinsonHyperlegible-Regular.woff2')
im.resize((1200,630),Image.Resampling.LANCZOS).save('public/social-preview-v1.png',optimize=True)

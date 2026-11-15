"""Render the geometric ARK monogram as dependency-free PNG install assets."""
import pathlib, struct, zlib
root=pathlib.Path(__file__).parent/'icons'
outer=[(152,350),(232,154),(280,154),(360,350),(307,350),(289,302),(222,302),(204,350)]
hole=[(239,258),(273,258),(256,210)]
def inside(x,y,poly):
    hit=False
    for i,(ax,ay) in enumerate(poly):
        bx,by=poly[i-1]
        if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax: hit=not hit
    return hit
def color(x,y):
    if inside(x,y,outer) and not inside(x,y,hole): return (238,238,238)
    if 224<=x<288 and 366<=y<382: return (238,238,238)
    return (0,0,0)
def chunk(kind,data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(size,path):
    pixels=bytearray()
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            samples=[color((x+(sx+.5)/2)*512/size,(y+(sy+.5)/2)*512/size) for sy in range(2) for sx in range(2)]
            pixels.extend(round(sum(c[k] for c in samples)/4) for k in range(3))
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(pixels))+chunk(b'IEND',b''))
for size,name in [(192,'icon-192.png'),(512,'icon-512.png'),(512,'maskable-512.png'),(180,'apple-touch-icon.png')]:
    png(size,root/name)

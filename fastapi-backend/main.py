from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import ezdxf, math, tempfile, os, uvicorn, traceback

from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
from ezdxf.addons.drawing.config import Configuration

app = FastAPI()

# Enable CORS so your React app can talk to it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def explode_all_blocks(msp):
    """Recursively explode INSERTs into raw entities."""
    inserts = list(msp.query("INSERT"))
    while inserts:
        for ins in inserts:
            ins.explode()
        inserts = list(msp.query("INSERT"))

@app.post("/quote")
async def get_quote(
    file: UploadFile = File(...),
    material: str = Form(...),
    thickness: float = Form(...),
    quantity: int = Form(...)
):
    content = await file.read()
    try:
        # write to a temp file so ezdxf can read it
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name

        doc = ezdxf.readfile(tmp_path)
        msp = doc.modelspace()
        explode_all_blocks(msp)

        # --- generate SVG preview ---
        import io, matplotlib.pyplot as plt
        from matplotlib.backends.backend_svg import FigureCanvasSVG

        fig, ax = plt.subplots()
        ctx = RenderContext(doc)
        out = MatplotlibBackend(ax)
        out.config = Configuration()
        Frontend(ctx, out).draw_layout(msp, finalize=True)

        svg_buf = io.StringIO()
        FigureCanvasSVG(fig).print_svg(svg_buf)
        svg_data = svg_buf.getvalue()

        # --- metrics & pricing ---
        min_x = min_y = math.inf
        max_x = max_y = -math.inf
        cut_length = 0
        hole_count = 0
        hole_diams = []
        entity_types = []

        for e in msp:
            t = e.dxftype()
            entity_types.append(t)

            if t == "CIRCLE":
                cx, cy = e.dxf.center.x, e.dxf.center.y
                r = e.dxf.radius
                cut_length += 2 * math.pi * r
                hole_count += 1
                hole_diams.append(round(2*r,2))
                min_x, max_x = min(min_x, cx-r), max(max_x, cx+r)
                min_y, max_y = min(min_y, cy-r), max(max_y, cy+r)

            elif t == "LINE":
                x1, y1 = e.dxf.start.x, e.dxf.start.y
                x2, y2 = e.dxf.end.x,   e.dxf.end.y
                cut_length += math.dist([x1,y1],[x2,y2])
                min_x, max_x = min(min_x,x1,x2), max(max_x,x1,x2)
                min_y, max_y = min(min_y,y1,y2), max(max_y,y1,y2)

            elif t in ("LWPOLYLINE","POLYLINE"):
                pts = []
                if t=="LWPOLYLINE":
                    pts = [(v[0],v[1]) for v in e.get_points()]
                else:
                    pts = [(v.dxf.location.x,v.dxf.location.y) for v in list(e.vertices())]
                for i in range(len(pts)-1):
                    x1,y1 = pts[i]; x2,y2 = pts[i+1]
                    cut_length += math.dist([x1,y1],[x2,y2])
                    min_x, max_x = min(min_x,x1,x2), max(max_x,x1,x2)
                    min_y, max_y = min(min_y,y1,y2), max(max_y,y1,y2)

            elif t == "SPLINE":
                # robustly extract points
                raw = []
                if hasattr(e, "fit_points"):
                    fp = e.fit_points
                    if callable(fp): fp = fp()
                    if isinstance(fp, (list,tuple)): raw = fp
                if not raw and hasattr(e, "control_points"):
                    cp = e.control_points
                    if callable(cp): cp = cp()
                    if isinstance(cp, (list,tuple)): raw = cp

                pts = []
                for p in raw:
                    if hasattr(p,"x") and hasattr(p,"y"):
                        pts.append((p.x,p.y))
                    elif isinstance(p,(list,tuple)) and len(p)>=2:
                        pts.append((p[0],p[1]))
                    elif hasattr(p,"__array__"):
                        a = p.tolist()
                        pts.append((a[0],a[1]))

                for i in range(len(pts)-1):
                    x1,y1 = pts[i]; x2,y2 = pts[i+1]
                    cut_length += math.dist([x1,y1],[x2,y2])
                    min_x, max_x = min(min_x,x1,x2), max(max_x,x1,x2)
                    min_y, max_y = min(min_y,y1,y2), max(max_y,y1,y2)

            elif t == "ARC":
                c = e.dxf.center; r=e.dxf.radius
                a1,a2 = math.radians(e.dxf.start_angle), math.radians(e.dxf.end_angle)
                cut_length += abs(a2-a1)*r
                min_x, max_x = min(min_x,c.x-r), max(max_x,c.x+r)
                min_y, max_y = min(min_y,c.y-r), max(max_y,c.y+r)

        if min_x==math.inf:
            return JSONResponse({
                "error":"No supported entities found",
                "entities_detected":list(set(entity_types))
            }, status_code=400)

        w,h = max_x-min_x, max_y-min_y
        metrics = {
            "bounding_box":[round(w,2),round(h,2)],
            "cut_length":round(cut_length,2),
            "hole_count":hole_count,
            "hole_diameters":hole_diams,
            "warnings":[]
        }

        # simple pricing model
        area_mm2 = w*h
        material_rate = {"Aluminum":50,"Steel":60,"Brass":70}.get(material,50)
        material_cost = (area_mm2/1e6)*material_rate
        cutting_cost  = (cut_length/1000)*0.2
        pierce_cost   = hole_count * 0.05
        setup         = 5
        total = (material_cost+cutting_cost+pierce_cost+setup)*quantity

        pricing = {
            "material_cost":round(material_cost,3),
            "cutting_cost":round(cutting_cost,3),
            "pierce_cost":round(pierce_cost,3),
            "setup_fee":setup,
            "total":round(total,3)
        }

        return JSONResponse({
            "metrics":metrics,
            "pricing":pricing,
            "preview_svg":svg_data,
            "entities_detected":list(set(entity_types))
        })

    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error":f"DXF parsing failed: {str(e)}"}, status_code=500)

if __name__=="__main__":
    port=int(os.getenv("PORT",8000))
    uvicorn.run("main:app",host="0.0.0.0",port=port)

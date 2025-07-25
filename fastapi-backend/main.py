from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import ezdxf, math, tempfile, os, uvicorn, traceback
from ezdxf.addons.drawing import matplotlib as ezdxf_draw
from ezdxf.addons.drawing.config import Configuration

app = FastAPI()

# ✅ Allow all origins for now (replace with Vercel URL later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/quote")
async def get_quote(file: UploadFile = File(...),
                    material: str = Form(...),
                    thickness: float = Form(...),
                    quantity: int = Form(...)):

    filename = file.filename.lower()
    content = await file.read()

    try:
        # ✅ Save DXF temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name

        doc = ezdxf.readfile(tmp_path)
        msp = doc.modelspace()

        # ✅ Generate SVG preview
        import io
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_svg import FigureCanvasSVG

        fig = plt.figure()
        ctx = ezdxf_draw.RenderContext(doc)
        out = ezdxf_draw.MatplotlibBackend(fig, Configuration())
        ezdxf_draw.draw_layout(msp, ctx, out, finalize=True)

        svg_buffer = io.StringIO()
        canvas = FigureCanvasSVG(fig)
        canvas.print_svg(svg_buffer)
        svg_data = svg_buffer.getvalue()

        # ✅ Metric calculations
        min_x = min_y = math.inf
        max_x = max_y = -math.inf
        cut_length = 0
        hole_count = 0
        hole_diams = []

        for e in msp:
            t = e.dxftype()
            if t == "CIRCLE":
                hole_count += 1
                cx, cy, r = e.dxf.center.x, e.dxf.center.y, e.dxf.radius
                min_x, max_x = min(min_x, cx - r), max(max_x, cx + r)
                min_y, max_y = min(min_y, cy - r), max(max_y, cy + r)
                cut_length += 2 * math.pi * r
                hole_diams.append(round(r * 2, 2))
            elif t == "LINE":
                x1, y1, x2, y2 = e.dxf.start.x, e.dxf.start.y, e.dxf.end.x, e.dxf.end.y
                min_x, max_x = min(min_x, x1, x2), max(max_x, x1, x2)
                min_y, max_y = min(min_y, y1, y2), max(max_y, y1, y2)
                cut_length += math.dist([x1, y1], [x2, y2])
            elif t == "LWPOLYLINE":
                pts = [(v[0], v[1]) for v in e.get_points()]
                for i in range(len(pts) - 1):
                    cut_length += math.dist(pts[i], pts[i + 1])
                    x1, y1 = pts[i]
                    x2, y2 = pts[i + 1]
                    min_x, max_x = min(min_x, x1, x2), max(max_x, x1, x2)
                    min_y, max_y = min(min_y, y1, y2), max(max_y, y1, y2)

        if min_x == math.inf:
            return {"error": "No supported entities found in DXF file."}

        width, height = max_x - min_x, max_y - min_y

        metrics = {
            "bounding_box": [round(width, 2), round(height, 2)],
            "cut_length": round(cut_length, 2),
            "hole_count": hole_count,
            "hole_diameters": hole_diams,
            "warnings": []
        }

        # ✅ Simple pricing model
        area_mm2 = metrics["bounding_box"][0] * metrics["bounding_box"][1]
        material_rate = {"Aluminum": 50, "Steel": 60, "Brass": 70}.get(material, 50)
        cutting_rate = 0.2
        pierce_rate = 0.05
        setup_fee = 5

        material_cost = (area_mm2 / 1e6) * material_rate
        cutting_cost = (metrics["cut_length"] / 1000) * cutting_rate
        pierce_cost = metrics["hole_count"] * pierce_rate
        total = (material_cost + cutting_cost + pierce_cost + setup_fee) * quantity

        pricing = {
            "material_cost": round(material_cost, 3),
            "cutting_cost": round(cutting_cost, 3),
            "pierce_cost": round(pierce_cost, 3),
            "setup_fee": setup_fee,
            "total": round(total, 3)
        }

        return JSONResponse(content={
            "metrics": metrics,
            "pricing": pricing,
            "preview_svg": svg_data
        })

    except Exception as e:
        traceback.print_exc()
        return {"error": f"DXF parsing failed: {str(e)}"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

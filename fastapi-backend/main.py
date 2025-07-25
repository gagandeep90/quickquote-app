from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import ezdxf, math, io, os, uvicorn, tempfile, traceback

app = FastAPI()

# ✅ Allow your Vercel frontend + local dev
origins = [
    "https://quickquote-krqbgubjl-gagandeeps-projects-cc22bc47.vercel.app",
    "http://localhost:3000"
]

aapp.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ Allow all for now
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

    metrics = {
        "bounding_box": (0, 0),
        "cut_length": 0,
        "hole_count": 0,
        "hole_diameters": [],
        "warnings": []
    }

    if filename.endswith(".dxf"):
        try:
            # ✅ Load file via temp file for ezdxf compatibility
            with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
                tmp.write(content)
                tmp.flush()
                tmp_path = tmp.name

            doc = ezdxf.readfile(tmp_path)
            msp = doc.modelspace()

            # ✅ Explode all block inserts to flatten geometry
            for insert in msp.query('INSERT'):
                insert.explode()

            min_x = min_y = math.inf
            max_x = max_y = -math.inf
            cut_length = 0
            holes = 0
            hole_diams = []

            for e in msp:
                t = e.dxftype()

                # CIRCLE
                if t == "CIRCLE":
                    holes += 1
                    cx, cy, r = e.dxf.center.x, e.dxf.center.y, e.dxf.radius
                    min_x, max_x = min(min_x, cx - r), max(max_x, cx + r)
                    min_y, max_y = min(min_y, cy - r), max(max_y, cy + r)
                    cut_length += 2 * math.pi * r
                    hole_diams.append(round(r * 2, 2))

                # LINE
                elif t == "LINE":
                    x1, y1, x2, y2 = e.dxf.start.x, e.dxf.start.y, e.dxf.end.x, e.dxf.end.y
                    min_x, max_x = min(min_x, x1, x2), max(max_x, x1, x2)
                    min_y, max_y = min(min_y, y1, y2), max(max_y, y1, y2)
                    cut_length += math.dist([x1, y1], [x2, y2])

                # ARC
                elif t == "ARC":
                    center = e.dxf.center
                    radius = e.dxf.radius
                    start_angle = math.radians(e.dxf.start_angle)
                    end_angle = math.radians(e.dxf.end_angle)
                    angle = abs(end_angle - start_angle)
                    cut_length += radius * angle
                    min_x = min(min_x, center.x - radius)
                    max_x = max(max_x, center.x + radius)
                    min_y = min(min_y, center.y - radius)
                    max_y = max(max_y, center.y + radius)

                # LWPOLYLINE
                elif t == "LWPOLYLINE":
                    pts = [(v[0], v[1]) for v in e.get_points()]
                    for i in range(len(pts) - 1):
                        cut_length += math.dist(pts[i], pts[i + 1])
                        x1, y1 = pts[i]
                        x2, y2 = pts[i + 1]
                        min_x, max_x = min(min_x, x1, x2), max(max_x, x1, x2)
                        min_y, max_y = min(min_y, y1, y2), max(max_y, y1, y2)

                # ✅ POLYLINE
                elif t == "POLYLINE":
                    pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
                    for i in range(len(pts) - 1):
                        cut_length += math.dist(pts[i], pts[i + 1])
                        x1, y1 = pts[i]
                        x2, y2 = pts[i + 1]
                        min_x, max_x = min(min_x, x1, x2), max(max_x, x1, x2)
                        min_y, max_y = min(min_y, y1, y2), max(max_y, y1, y2)

                # ✅ SPLINE (approximate using fit points)
                elif t == "SPLINE":
                    fit_points = e.fit_points
                    for i in range(len(fit_points) - 1):
                        p1 = fit_points[i]
                        p2 = fit_points[i + 1]
                        cut_length += math.dist((p1[0], p1[1]), (p2[0], p2[1]))
                        min_x, max_x = min(min_x, p1[0], p2[0]), max(max_x, p1[0], p2[0])
                        min_y, max_y = min(min_y, p1[1], p2[1]), max(max_y, p1[1], p2[1])

            if min_x == math.inf:
                return {"error": "No supported entities found in DXF file."}

            width, height = max_x - min_x, max_y - min_y
            metrics["bounding_box"] = (round(width, 2), round(height, 2))
            metrics["cut_length"] = round(cut_length, 2)
            metrics["hole_count"] = holes
            metrics["hole_diameters"] = hole_diams

            # ✅ DfM Checks
            if width > 1200 or height > 2400:
                metrics["warnings"].append("Part exceeds max sheet size (1200x2400mm).")
            for d in hole_diams:
                if d < (1.5 * thickness):
                    metrics["warnings"].append(f"Hole {d}mm may be too small for {thickness}mm material.")

        except Exception as e:
            traceback.print_exc()
            return {"error": f"DXF parsing failed: {str(e)}"}

    else:
        return {"error": "Unsupported file format. Upload DXF."}

    # ✅ Pricing
    area_mm2 = metrics["bounding_box"][0] * metrics["bounding_box"][1]
    material_rate = {"Aluminum": 50, "Steel": 60, "Brass": 70}.get(material, 50)
    cutting_rate = 0.2
    pierce_rate = 0.05
    setup_fee = 5

    material_cost = (area_mm2 / 1e6) * material_rate
    cutting_cost = (metrics["cut_length"] / 1000) * cutting_rate
    pierce_cost = metrics["hole_count"] * pierce_rate
    total = (material_cost + cutting_cost + pierce_cost + setup_fee) * quantity

    return {
        "metrics": metrics,
        "pricing": {
            "material_cost": round(material_cost, 3),
            "cutting_cost": round(cutting_cost, 3),
            "pierce_cost": round(pierce_cost, 3),
            "setup_fee": setup_fee,
            "total": round(total, 3)
        }
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

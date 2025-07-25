from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import ezdxf
import math
import io
import os
import uvicorn

app = FastAPI()

# Allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/quote")
async def get_quote(file: UploadFile = File(...),
                    material: str = Form(...),
                    thickness: float = Form(...),
                    quantity: int = Form(...)):

    print(f"Received file: {file.filename}")
    print(f"Material: {material}, Thickness: {thickness}, Quantity: {quantity}")

    filename = file.filename.lower()
    content = await file.read()

    metrics = {
        "bounding_box": (0, 0),
        "cut_length": 0,
        "hole_count": 0,
        "warnings": []
    }

    # DXF parsing
    if filename.endswith(".dxf"):
        try:
            doc = ezdxf.read(io.BytesIO(content))
            msp = doc.modelspace()

            min_x = min_y = math.inf
            max_x = max_y = -math.inf
            cut_length = 0
            holes = 0

            for e in msp:
                if e.dxftype() == "CIRCLE":
                    holes += 1
                    cx, cy, r = e.dxf.center.x, e.dxf.center.y, e.dxf.radius
                    min_x, max_x = min(min_x, cx - r), max(max_x, cx + r)
                    min_y, max_y = min(min_y, cy - r), max(max_y, cy + r)
                    cut_length += 2 * math.pi * r

                elif e.dxftype() == "LINE":
                    x1, y1, x2, y2 = e.dxf.start.x, e.dxf.start.y, e.dxf.end.x, e.dxf.end.y
                    min_x, max_x = min(min_x, x1, x2), max(max_x, x1, x2)
                    min_y, max_y = min(min_y, y1, y2), max(max_y, y1, y2)
                    cut_length += math.dist([x1, y1], [x2, y2])

            width, height = max_x - min_x, max_y - min_y
            metrics["bounding_box"] = (round(width, 2), round(height, 2))
            metrics["cut_length"] = round(cut_length, 2)
            metrics["hole_count"] = holes

            if width > 1200 or height > 2400:
                metrics["warnings"].append("Part exceeds maximum sheet size (1200x2400mm).")
            if holes > 0 and thickness > 5:
                metrics["warnings"].append("Small holes in thick material may be uncuttable.")

        except Exception as e:
            return {"error": f"DXF parsing failed: {str(e)}"}

    elif filename.endswith(".step") or filename.endswith(".stp"):
        metrics["warnings"].append("STEP parsing placeholder: metrics not computed yet.")

    # Pricing (dummy logic)
    area = metrics["bounding_box"][0] * metrics["bounding_box"][1]
    material_rate = {"Aluminum": 1.2, "Steel": 1.5, "Brass": 1.8}.get(material, 1.0)
    cutting_rate = 0.05
    setup_fee = 10

    material_cost = (area / 10000) * material_rate
    cutting_cost = metrics["cut_length"] * cutting_rate
    total = (material_cost + cutting_cost + setup_fee) * quantity

    return {
        "metrics": metrics,
        "pricing": {
            "material_cost": round(material_cost, 2),
            "cutting_cost": round(cutting_cost, 2),
            "setup_fee": setup_fee,
            "total": round(total, 2)
        }
    }

# ✅ Railway needs this to bind the correct port
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

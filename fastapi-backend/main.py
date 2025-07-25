from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import ezdxf, tempfile, os, uvicorn, traceback
from collections import Counter

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/quote")
async def inspect_dxf(file: UploadFile = File(...)):
    content = await file.read()
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as tmp:
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name

        doc = ezdxf.readfile(tmp_path)

        # ✅ Scan all layouts
        entity_types = []

        for layout in doc.layouts:
            for e in doc.layouts.get(layout.name):
                entity_types.append(e.dxftype())

        # ✅ Scan all blocks
        for block_name, block in doc.blocks.items():
            for e in block:
                entity_types.append(e.dxftype())

        # ✅ Modelspace entities
        for e in doc.modelspace():
            entity_types.append(e.dxftype())

        if not entity_types:
            return {"message": "No entities found anywhere in DXF."}

        counts = Counter(entity_types)

        return JSONResponse(content={
            "status": "DXF inspected",
            "total_entities": len(entity_types),
            "unique_types": list(set(entity_types)),
            "entity_counts": dict(counts)
        })

    except Exception as e:
        traceback.print_exc()
        return {"error": f"DXF inspection failed: {str(e)}"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

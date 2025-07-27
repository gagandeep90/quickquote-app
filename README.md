# Advanced DXF Viewer

This project provides a simple DXF file viewer that runs entirely in the browser.
It uses **dxf-parser** and **Three.js** to parse DXF files and render them in 3D.

## Usage

1. Install Node.js if you don't already have it.
2. Run `node server.js` to start a static file server.
3. Open [http://localhost:8080](http://localhost:8080) in your browser.
4. Use the file picker at the top left to upload a `.dxf` file. The file will be
   parsed and displayed in a 3D scene.

> **Note**: The viewer relies on CDN links for `three`, `OrbitControls`,
> `dxf-parser`, and `three-dxf`. Internet access is required for the viewer to
> load these libraries.

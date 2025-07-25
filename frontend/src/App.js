import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import DxfParser from 'dxf-parser';

const backendUrl = 'https://quickquote-app-production-712f.up.railway.app';

function App() {
  const [file, setFile] = useState(null);
  const [material, setMaterial] = useState('Aluminum');
  const [thickness, setThickness] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewSvg, setPreviewSvg] = useState(null);

  const onDrop = (acceptedFiles) => {
    const f = acceptedFiles[0];
    setFile(f);
    setQuote(null);
    renderPreview(f);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const renderPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('DXF file loaded, parsing...');
        const parser = new DxfParser();
        const dxf = parser.parseSync(e.target.result);
        console.log('Parsed DXF:', dxf);
        console.log('Entities:', dxf.entities);

        const entities = dxf.entities.filter(ent =>
          ['LINE','LWPOLYLINE','POLYLINE','CIRCLE','ARC','SPLINE'].includes(ent.type)
        );

        if (!entities.length) {
          console.warn('No supported entities for preview.');
          setPreviewSvg('<p style="color:red">No supported geometry in DXF</p>');
          return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let paths = '';

        entities.forEach(ent => {
          if (ent.type === 'LINE') {
            minX = Math.min(minX, ent.start.x, ent.end.x);
            maxX = Math.max(maxX, ent.start.x, ent.end.x);
            minY = Math.min(minY, ent.start.y, ent.end.y);
            maxY = Math.max(maxY, ent.start.y, ent.end.y);
            paths += `<line x1="${ent.start.x}" y1="${-ent.start.y}" x2="${ent.end.x}" y2="${-ent.end.y}" stroke="black"/>`;
          }
          else if (ent.type === 'CIRCLE') {
            minX = Math.min(minX, ent.center.x - ent.radius);
            maxX = Math.max(maxX, ent.center.x + ent.radius);
            minY = Math.min(minY, ent.center.y - ent.radius);
            maxY = Math.max(maxY, ent.center.y + ent.radius);
            paths += `<circle cx="${ent.center.x}" cy="${-ent.center.y}" r="${ent.radius}" stroke="blue" fill="none"/>`;
          }
          else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
            const pts = (ent.vertices || []).map(v => `${v.x},${-v.y}`).join(' ');
            minX = Math.min(minX, ...ent.vertices.map(v => v.x));
            maxX = Math.max(maxX, ...ent.vertices.map(v => v.x));
            minY = Math.min(minY, ...ent.vertices.map(v => v.y));
            maxY = Math.max(maxY, ...ent.vertices.map(v => v.y));
            paths += `<polyline points="${pts}" stroke="black" fill="none"/>`;
          }
          else if (ent.type === 'SPLINE') {
            const pts = (ent.fitPoints || []).map(v => `${v.x},${-v.y}`).join(' ');
            if (ent.fitPoints?.length) {
              minX = Math.min(minX, ...ent.fitPoints.map(v => v.x));
              maxX = Math.max(maxX, ...ent.fitPoints.map(v => v.x));
              minY = Math.min(minY, ...ent.fitPoints.map(v => v.y));
              maxY = Math.max(maxY, ...ent.fitPoints.map(v => v.y));
              paths += `<polyline points="${pts}" stroke="green" fill="none"/>`;
            }
          }
        });

        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 10;

        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg"
               viewBox="${minX - padding} ${-(maxY + padding)} ${width + padding * 2} ${height + padding * 2}"
               preserveAspectRatio="xMidYMid meet"
               style="width:100%;height:auto;border:1px solid #ccc;background:#fff">
            ${paths}
          </svg>
        `;
        setPreviewSvg(svg);
      } catch (err) {
        console.error('DXF preview error:', err);
        setPreviewSvg('<p style="color:red">Failed to render DXF preview</p>');
      }
    };
    reader.readAsText(file);
  };

  const getQuote = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('material', material);
    formData.append('thickness', thickness);
    formData.append('quantity', quantity);

    try {
      setLoading(true);
      const response = await axios.post(`${backendUrl}/quote`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Backend Response:', response.data);
      setQuote(response.data);
    } catch (err) {
      console.error('Quote error:', err);
      alert('Failed to get quote. Check backend logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: 'Arial, sans-serif' }}>
      <h2>QuickQuote Platform</h2>

      {/* File Upload */}
      <div {...getRootProps()} style={{ border: '2px dashed gray', padding: 20, marginBottom: 20, cursor: 'pointer' }}>
        <input {...getInputProps()} />
        {file ? <p>{file.name}</p> : <p>Drag & drop DXF file here or click to select</p>}
      </div>

      {/* Preview */}
      {previewSvg && (
        <div style={{ marginBottom: 20 }}>
          <h3>Preview</h3>
          <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
        </div>
      )}

      {/* Config */}
      <label>
        Material:
        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
          <option>Aluminum</option>
          <option>Steel</option>
          <option>Brass</option>
        </select>
      </label>

      <br /><br />

      <label>
        Thickness (mm):
        <input type="number" value={thickness} onChange={(e) => setThickness(e.target.value)} />
      </label>

      <br /><br />

      <label>
        Quantity:
        <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>

      <br /><br />

      <button onClick={getQuote} disabled={!file || loading}>
        {loading ? 'Calculating...' : 'Get Quote'}
      </button>

      {/* Quote Results */}
      {quote && !quote.error && (
        <div style={{ marginTop: 30, padding: 20, border: '1px solid #ccc', background: '#f9f9f9' }}>
          <h3>Metrics</h3>
          <p>Bounding Box: {quote.metrics.bounding_box[0]} × {quote.metrics.bounding_box[1]} mm</p>
          <p>Cut Length: {quote.metrics.cut_length} mm</p>
          <p>Hole Count: {quote.metrics.hole_count}</p>
          <p>Hole Diameters: {quote.metrics.hole_diameters.join(', ')} mm</p>

          <h3>Pricing</h3>
          <p>Material: {quote.pricing.material_cost} OMR</p>
          <p>Cutting: {quote.pricing.cutting_cost} OMR</p>
          <p>Pierce: {quote.pricing.pierce_cost} OMR</p>
          <p>Setup: {quote.pricing.setup_fee} OMR</p>
          <strong>Total: {quote.pricing.total} OMR</strong>
        </div>
      )}

      {quote && quote.error && (
        <div style={{ color: 'red', marginTop: 20 }}>
          <strong>Error:</strong> {quote.error}
        </div>
      )}
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import DxfParser from 'dxf-parser';

function App() {
  const [file, setFile] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);

  const onDrop = acceptedFiles => {
    const f = acceptedFiles[0];
    setFile(f);
    setQuote(null);
    setError(null);

    // ✅ Generate instant preview
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(e.target.result);
        const entities = dxf.entities || [];

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let paths = [];

        entities.forEach(ent => {
          if (ent.type === 'LINE') {
            const { x: x1, y: y1 } = ent.start;
            const { x: x2, y: y2 } = ent.end;
            paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
            minX = Math.min(minX, x1, x2);
            minY = Math.min(minY, y1, y2);
            maxX = Math.max(maxX, x1, x2);
            maxY = Math.max(maxY, y1, y2);
          }

          if (ent.type === 'SPLINE') {
            const pts = ent.fitPoints && ent.fitPoints.length > 0 ? ent.fitPoints : ent.controlPoints;
            for (let i = 0; i < pts.length - 1; i++) {
              const x1 = pts[i].x, y1 = pts[i].y;
              const x2 = pts[i + 1].x, y2 = pts[i + 1].y;
              paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
              minX = Math.min(minX, x1, x2);
              minY = Math.min(minY, y1, y2);
              maxX = Math.max(maxX, x1, x2);
              maxY = Math.max(maxY, y1, y2);
            }
          }
        });

        if (paths.length > 0) {
          const width = maxX - minX || 1;
          const height = maxY - minY || 1;
          const viewBox = `${minX} ${-maxY} ${width} ${height}`;
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${paths.join('')}</svg>`;
          setLocalPreview(svg);
        } else {
          setLocalPreview(null);
        }
      } catch (err) {
        console.error('DXF parse error:', err);
        setLocalPreview(null);
      }
    };
    reader.readAsText(f);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const getQuote = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('material', 'Steel');
    formData.append('thickness', 2);
    formData.append('quantity', 1);

    try {
      const res = await axios.post(
        'https://quickquote-app-production-712f.up.railway.app/quote',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setQuote(res.data);
      setError(null);
    } catch (err) {
      setQuote(null);
      if (err.response?.data) {
        setError(err.response.data);
      } else {
        setError({ error: 'Failed to get quote. Check backend logs.' });
      }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h2>Quick Quote DXF</h2>

      <div {...getRootProps()} style={{ border: '2px dashed gray', padding: '20px', marginBottom: '10px' }}>
        <input {...getInputProps()} />
        {file ? <p>{file.name}</p> : <p>Drag & drop DXF file here, or click to select</p>}
      </div>

      {localPreview && (
        <div style={{
          border: '1px solid #ccc',
          margin: '10px 0',
          width: '400px',
          height: '400px',
          background: '#fff',
          overflow: 'hidden'
        }}
          dangerouslySetInnerHTML={{ __html: localPreview }}
        />
      )}

      <button onClick={getQuote} style={{ padding: '10px 20px' }}>Get Quote</button>

      {quote && (
        <div style={{ marginTop: '20px' }}>
          <h3>Quote Results</h3>
          <p><strong>Total:</strong> ${quote.pricing.total}</p>
          <p><strong>Cut Length:</strong> {quote.metrics.cut_length} mm</p>
          <p><strong>Bounding Box:</strong> {quote.metrics.bounding_box.join(' x ')} mm</p>
          <p><strong>Hole Count:</strong> {quote.metrics.hole_count}</p>

          {quote.preview_svg && (
            <div style={{
              border: '1px solid #ccc',
              marginTop: '10px',
              width: '400px',
              height: '400px',
              background: '#fff',
              overflow: 'hidden'
            }}
              dangerouslySetInnerHTML={{ __html: quote.preview_svg }}
            />
          )}

          {quote.entities_detected && (
            <p><strong>Entities Detected:</strong> {quote.entities_detected.join(', ')}</p>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '20px', color: 'red' }}>
          <h3>Error</h3>
          <p>{error.error}</p>
          {error.entities_detected && error.entities_detected.length > 0 && (
            <p><strong>Entities Detected:</strong> {error.entities_detected.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

const backendUrl = 'https://quickquote-app-production-712f.up.railway.app';

function App() {
  const [file, setFile] = useState(null);
  const [material, setMaterial] = useState('Aluminum');
  const [thickness, setThickness] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = (acceptedFiles) => {
    const f = acceptedFiles[0];
    setFile(f);
    setQuote(null);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

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

      {/* ✅ Server-Side DXF SVG Preview */}
      {quote && quote.preview_svg && (
        <div style={{ border: '1px solid #ccc', marginTop: 20, padding: 10, background: '#fff' }}>
          <h3>Preview</h3>
          <div dangerouslySetInnerHTML={{ __html: quote.preview_svg }} />
        </div>
      )}

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

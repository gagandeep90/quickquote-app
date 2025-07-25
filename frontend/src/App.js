import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

// ✅ Replace this with your actual Railway backend URL
const backendUrl = 'https://quickquote-app-production-712f.up.railway.app';

function App() {
  const [file, setFile] = useState(null);
  const [material, setMaterial] = useState('Aluminum');
  const [thickness, setThickness] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = (acceptedFiles) => {
    setFile(acceptedFiles[0]);
    setQuote(null); // reset quote if new file uploaded
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
        {file ? <p>{file.name}</p> : <p>Drag & drop DXF/SVG/STEP file here or click to select</p>}
      </div>

      {/* Material */}
      <label>
        Material:
        <select value={material} onChange={(e) => setMaterial(e.target.value)}>
          <option>Aluminum</option>
          <option>Steel</option>
          <option>Brass</option>
        </select>
      </label>

      <br /><br />

      {/* Thickness */}
      <label>
        Thickness (mm):
        <input
          type="number"
          value={thickness}
          min="0.5"
          step="0.5"
          onChange={(e) => setThickness(e.target.value)}
        />
      </label>

      <br /><br />

      {/* Quantity */}
      <label>
        Quantity:
        <input
          type="number"
          value={quantity}
          min="1"
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>

      <br /><br />

      <button onClick={getQuote} disabled={!file || loading}>
        {loading ? 'Calculating...' : 'Get Quote'}
      </button>

      {/* Quote Results */}
      {quote && (
        <div style={{ marginTop: 30, padding: 20, border: '1px solid #ccc', background: '#f9f9f9' }}>
          <h3>Part Metrics</h3>
          <p>Bounding Box: {quote.metrics.bounding_box[0]} x {quote.metrics.bounding_box[1]} mm</p>
          <p>Cut Length: {quote.metrics.cut_length} mm</p>
          <p>Hole Count: {quote.metrics.hole_count}</p>

          {quote.metrics.warnings.length > 0 && (
            <div style={{ color: 'red' }}>
              <strong>Warnings:</strong>
              <ul>
                {quote.metrics.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <h3>Quote</h3>
          <p>Material Cost: {quote.pricing.material_cost} OMR</p>
          <p>Cutting Cost: {quote.pricing.cutting_cost} OMR</p>
          <p>Setup Fee: {quote.pricing.setup_fee} OMR</p>
          <strong>Total: {quote.pricing.total} OMR</strong>
        </div>
      )}
    </div>
  );
}

export default App;

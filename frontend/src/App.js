import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

function App() {
  const [file, setFile] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = async acceptedFiles => {
    const f = acceptedFiles[0];
    setFile(f);
    setQuote(null);
    setError(null);

    // Instant server‑side preview call
    const form = new FormData();
    form.append('file', f);
    try {
      const res = await axios.post(
        'https://quickquote-app-production-712f.up.railway.app/preview',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' }}
      );
      setLocalPreview(res.data.preview_svg || null);
    } catch (err) {
      console.error('Preview error', err);
      setLocalPreview(null);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const getQuote = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('material', 'Steel');
    fd.append('thickness', 2);
    fd.append('quantity', 1);
    try {
      const res = await axios.post(
        'https://quickquote-app-production-712f.up.railway.app/quote',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' }}
      );
      setQuote(res.data);
      setError(null);
    } catch (err) {
      setQuote(null);
      setError(err.response?.data || { error: 'Server error' });
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h2>Quick Quote DXF</h2>

      <div
        {...getRootProps()}
        style={{ border: '2px dashed gray', padding: 20, marginBottom: 10 }}
      >
        <input {...getInputProps()} />
        {file ? <p>{file.name}</p> : <p>Drag & drop DXF here</p>}
      </div>

      {localPreview && (
        <div
          style={{
            border: '1px solid #ccc',
            width: 400,
            height: 400,
            overflow: 'auto',
            margin: '10px auto',
          }}
          dangerouslySetInnerHTML={{ __html: localPreview }}
        />
      )}

      <button onClick={getQuote} style={{ padding: 10 }}>
        Get Quote
      </button>

      {quote && (
        <div style={{ marginTop: 20 }}>
          <h3>Quote Results</h3>
          <p>
            <strong>Total:</strong> ${quote.pricing.total}
          </p>
          <p>
            <strong>Cut Length:</strong> {quote.metrics.cut_length} mm
          </p>
          <p>
            <strong>Bounding Box:</strong>{' '}
            {quote.metrics.bounding_box[0]} × {quote.metrics.bounding_box[1]} mm
          </p>
          <p>
            <strong>Hole Count:</strong> {quote.metrics.hole_count}
          </p>
          {quote.metrics.hole_diameters.length > 0 && (
            <p>
              <strong>Hole Ø:</strong>{' '}
              {quote.metrics.hole_diameters.join(', ')} mm
            </p>
          )}
          <div
            style={{
              border: '1px solid #ccc',
              width: 400,
              height: 400,
              overflow: 'auto',
              marginTop: 10,
            }}
            dangerouslySetInnerHTML={{ __html: quote.preview_svg }}
          />
        </div>
      )}

      {error && (
        <div style={{ color: 'red', marginTop: 20 }}>
          <h3>Error</h3>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;

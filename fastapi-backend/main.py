import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

function App() {
  const [file, setFile] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = acceptedFiles => {
    setFile(acceptedFiles[0]);
    setQuote(null);
    setError(null);
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

      <button onClick={getQuote} style={{ padding: '10px 20px' }}>Get Quote</button>

      {quote && (
        <div style={{ marginTop: '20px' }}>
          <h3>Quote Results</h3>
          <p><strong>Total:</strong> ${quote.pricing.total}</p>
          <p><strong>Cut Length:</strong> {quote.metrics.cut_length} mm</p>
          <p><strong>Bounding Box:</strong> {quote.metrics.bounding_box.join(' x ')} mm</p>
          <p><strong>Hole Count:</strong> {quote.metrics.hole_count}</p>

          {quote.preview_svg && (
            <div
              style={{
                border: '1px solid #ccc',
                marginTop: '10px',
                width: '400px',
                height: '400px',
                overflow: 'auto',
                background: '#fff'
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

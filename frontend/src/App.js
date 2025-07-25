import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

const backendUrl = 'https://quickquote-app-production.up.railway.app'; // Replace after deployment

function App() {
  const [file, setFile] = useState(null);
  const [material, setMaterial] = useState('Aluminum');
  const [thickness, setThickness] = useState('1mm');
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState(null);

  const onDrop = (acceptedFiles) => {
    setFile(acceptedFiles[0]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const getQuote = async () => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('material', material);
    formData.append('thickness', thickness);
    formData.append('quantity', quantity);

    const response = await axios.post(`${backendUrl}/api/parse-and-quote`, formData);
    setQuote(response.data);
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>QuickQuote App</h2>

      <div {...getRootProps()} style={{ border: '1px dashed gray', padding: 20 }}>
        <input {...getInputProps()} />
        <p>{file ? file.name : 'Drag and drop a file here, or click to select'}</p>
      </div>

      <select value={material} onChange={(e) => setMaterial(e.target.value)}>
        <option>Aluminum</option>
        <option>Steel</option>
        <option>Brass</option>
      </select>

      <select value={thickness} onChange={(e) => setThickness(e.target.value)}>
        <option>1mm</option>
        <option>2mm</option>
        <option>3mm</option>
      </select>

      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        min={1}
        placeholder="Quantity"
      />

      <button onClick={getQuote} disabled={!file}>
        Get Quote
      </button>

      {quote && (
        <div style={{ marginTop: 20 }}>
          <h3>Quote:</h3>
          <p>Material Cost: {quote.materialCost} OMR</p>
          <p>Cutting Cost: {quote.cuttingCost} OMR</p>
          <p>Setup Cost: {quote.setupCost} OMR</p>
          <strong>Total: {quote.total} OMR</strong>
        </div>
      )}
    </div>
  );
}

export default App;

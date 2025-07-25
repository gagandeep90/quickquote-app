import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import DxfParser from 'dxf-parser';

function App() {
  const [file, setFile] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = files => {
    const f = files[0];
    setFile(f);
    setQuote(null);
    setError(null);

    // Instant preview
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(e.target.result);
        const ents = dxf.entities || [];
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        const paths = [];

        ents.forEach(ent => {
          if (ent.type==='LINE') {
            const {x:x1,y:y1}=ent.start, {x:x2,y:y2}=ent.end;
            paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
            minX=Math.min(minX,x1,x2); maxX=Math.max(maxX,x1,x2);
            minY=Math.min(minY,y1,y2); maxY=Math.max(maxY,y1,y2);
          }
          if (ent.type==='SPLINE') {
            const pts = ent.fitPoints?.length>0 ? ent.fitPoints : ent.controlPoints||[];
            pts.forEach((p,i)=>{
              if (i<pts.length-1){
                const p2=pts[i+1];
                const x1=p.x||p[0], y1=p.y||p[1];
                const x2=p2.x||p2[0], y2=p2.y||p2[1];
                paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
                minX=Math.min(minX,x1,x2); maxX=Math.max(maxX,x1,x2);
                minY=Math.min(minY,y1,y2); maxY=Math.max(maxY,y1,y2);
              }
            });
          }
        });

        if (paths.length) {
          const w = maxX-minX||1, h=maxY-minY||1;
          const viewBox = `${minX} ${-maxY} ${w} ${h}`;
          setLocalPreview(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${paths.join('')}</svg>`
          );
        } else {
          setLocalPreview(null);
        }
      } catch {
        setLocalPreview(null);
      }
    };
    reader.readAsText(f);
  };

  const {getRootProps,getInputProps} = useDropzone({onDrop});

  const getQuote = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('material', 'Steel');
    fd.append('thickness', 2);
    fd.append('quantity', 1);
    try {
      const res = await axios.post('https://your-backend-url/quote', fd, {
        headers: {'Content-Type':'multipart/form-data'}
      });
      setQuote(res.data);
      setError(null);
    } catch (err) {
      setQuote(null);
      setError(err.response?.data || {error:'Unexpected error'});
    }
  };

  return (
    <div style={{padding:20,fontFamily:'Arial'}}>
      <h2>Quick Quote DXF</h2>
      <div {...getRootProps()} style={{border:'2px dashed gray',padding:20,margin:10}}>
        <input {...getInputProps()} />
        {file ? <p>{file.name}</p> : <p>Drag & drop DXF here</p>}
      </div>
      {localPreview && (
        <div style={{border:'1px solid #ccc',width:400,height:400,overflow:'auto',margin:'auto'}}>
          <div dangerouslySetInnerHTML={{__html:localPreview}} />
        </div>
      )}
      <button onClick={getQuote} style={{marginTop:10,padding:10}}>Get Quote</button>
      {quote && (
        <div style={{marginTop:20}}>
          <h3>Results</h3>
          <p><strong>Total:</strong> ${quote.pricing.total}</p>
          <div dangerouslySetInnerHTML={{__html:quote.preview_svg}} style={{border:'1px solid #ccc',width:400,height:400,overflow:'auto'}}/>
        </div>
      )}
      {error && <pre style={{color:'red'}}>{JSON.stringify(error,null,2)}</pre>}
    </div>
  );
}

export default App;

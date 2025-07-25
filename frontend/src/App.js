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

    // Instant preview + local metrics
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(e.target.result);
        const ents = dxf.entities || [];

        let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
        let paths = [];
        let localCut = 0;
        let localHoleCount = 0;
        let localHoleD = [];

        ents.forEach(ent => {
          switch(ent.type) {
            case 'LINE': {
              const {x:x1,y:y1}=ent.start, {x:x2,y:y2}=ent.end;
              paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
              localCut += Math.hypot(x2-x1,y2-y1);
              minX=Math.min(minX,x1,x2); maxX=Math.max(maxX,x1,x2);
              minY=Math.min(minY,y1,y2); maxY=Math.max(maxY,y1,y2);
              break;
            }
            case 'CIRCLE': {
              const {x:cx,y:cy}=ent.center, r=ent.radius;
              paths.push(`<circle cx="${cx}" cy="${-cy}" r="${r}" stroke="black" fill="none"/>`);
              localCut += 2*Math.PI*r;
              localHoleCount++;
              localHoleD.push(parseFloat((2*r).toFixed(2)));
              minX=Math.min(minX,cx-r); maxX=Math.max(maxX,cx+r);
              minY=Math.min(minY,cy-r); maxY=Math.max(maxY,cy+r);
              break;
            }
            case 'ARC': {
              const {x:cx,y:cy}=ent.center, r=ent.radius;
              const a1=ent.startAngle*Math.PI/180, a2=ent.endAngle*Math.PI/180;
              const steps=30, da=(a2-a1)/steps;
              let pts=[];
              for(let i=0;i<=steps;i++){
                const a=a1+da*i;
                const x=cx+Math.cos(a)*r, y=cy+Math.sin(a)*r;
                pts.push([x,y]);
              }
              pts.forEach((p,i)=>{
                if(i>0){
                  const [x1,y1]=pts[i-1], [x2,y2]=p;
                  paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
                  localCut += Math.hypot(x2-x1,y2-y1);
                  minX=Math.min(minX,x1,x2); maxX=Math.max(maxX,x1,x2);
                  minY=Math.min(minY,y1,y2); maxY=Math.max(maxY,y1,y2);
                }
              });
              break;
            }
            case 'LWPOLYLINE': {
              const pts = ent.vertices.map(v=>[v.x,v.y]);
              for(let i=1;i<pts.length;i++){
                const [x1,y1]=pts[i-1], [x2,y2]=pts[i];
                paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
                localCut += Math.hypot(x2-x1,y2-y1);
                minX=Math.min(minX,x1,x2); maxX=Math.max(maxX,x1,x2);
                minY=Math.min(minY,y1,y2); maxY=Math.max(maxY,y1,y2);
              }
              break;
            }
            case 'POLYLINE': {
              const pts = ent.vertices.map(v=>[v.x,v.y]);
              for(let i=1;i<pts.length;i++){
                const [x1,y1]=pts[i-1], [x2,y2]=pts[i];
                paths.push(`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="black"/>`);
                localCut += Math.hypot(x2-x1,y2-y1);
                minX=Math.min(minX,x1,x2); maxX=Math.max(maxX,x1,x2);
                minY=Math.min(minY,y1,y2); maxY=Math.max(maxY,y1,y2);
              }
              break;
            }
            case 'SPLINE': {
              let raw = [];
              if(ent.fitPoints && ent.fitPoints.length) raw=ent.fitPoints;
              else if(ent.controlPoints) raw=ent.controlPoints;
              raw.forEach((p,i)=>{
                if(i>0){
                  const x1=p.x||p[0]||0, y1=p.y||p[1]||0;
                  const prev=raw[i-1];
                  const x0=prev.x||prev[0]||0, y0=prev.y||prev[1]||0;
                  paths.push(`<line x1="${x0}" y1="${-y0}" x2="${x1}" y2="${-y1}" stroke="black"/>`);
                  localCut += Math.hypot(x1-x0,y1-y0);
                  minX=Math.min(minX,x0,x1); maxX=Math.max(maxX,x0,x1);
                  minY=Math.min(minY,y0,y1); maxY=Math.max(maxY,y0,y1);
                }
              });
              break;
            }
            default:
              break;
          }
        });

        if(paths.length){
          const w=maxX-minX||1, h=maxY-minY||1;
          const vb=`${minX} ${-maxY} ${w} ${h}`;
          setLocalPreview(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${paths.join('')}</svg>`);
        } else {
          setLocalPreview(null);
        }
      } catch {
        setLocalPreview(null);
      }
    };
    reader.readAsText(f);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const getQuote = async () => {
    if(!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('material','Steel');
    fd.append('thickness',2);
    fd.append('quantity',1);
    try {
      const res = await axios.post(
        'https://quickquote-app-production-712f.up.railway.app/quote',
        fd,
        { headers:{ 'Content-Type':'multipart/form-data' }}
      );
      setQuote(res.data);
      setError(null);
    } catch(err) {
      setQuote(null);
      setError(err.response?.data || { error:'Server error' });
    }
  };

  return (
    <div style={{ padding:20, fontFamily:'Arial' }}>
      <h2>Quick Quote DXF</h2>
      <div {...getRootProps()} style={{border:'2px dashed gray',padding:20,marginBottom:10}}>
        <input {...getInputProps()} />
        { file ? <p>{file.name}</p> : <p>Drag & drop DXF here</p> }
      </div>

      { localPreview && (
        <div style={{
          border:'1px solid #ccc',
          width:400, height:400,
          overflow:'auto', margin:'auto 0 10px'
        }}
        dangerouslySetInnerHTML={{ __html: localPreview }} />
      )}

      <button onClick={getQuote} style={{ padding:10 }}>Get Quote</button>

      { quote && (
        <div style={{ marginTop:20 }}>
          <h3>Quote Results</h3>
          <p><strong>Total:</strong> ${quote.pricing.total}</p>
          <p><strong>Cut Length:</strong> {quote.metrics.cut_length} mm</p>
          <p><strong>Bounding Box:</strong> {quote.metrics.bounding_box[0]} × {quote.metrics.bounding_box[1]} mm</p>
          <p><strong>Hole Count:</strong> {quote.metrics.hole_count}</p>
          { quote.metrics.hole_diameters.length>0 &&
            <p><strong>Hole Ø:</strong> {quote.metrics.hole_diameters.join(', ')} mm</p>
          }
          <div style={{
            border:'1px solid #ccc',
            width:400, height:400,
            overflow:'auto', marginTop:10
          }}
          dangerouslySetInnerHTML={{ __html: quote.preview_svg }} />
        </div>
      )}

      { error && (
        <div style={{ color:'red', marginTop:20 }}>
          <h3>Error</h3>
          <pre>{JSON.stringify(error,null,2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;

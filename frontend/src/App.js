import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DXFLoader } from 'three-dxf';

function App() {
  const [file, setFile] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const mountRef = useRef(null);

  // Initialize Three.js scene only once
  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000);
    camera.position.set(0, 0, 200);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambient = new THREE.AmbientLight(0x606060);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff);
    dir.position.set(1, 1, 1).normalize();
    scene.add(dir);

    const dxfGroup = new THREE.Group();
    scene.add(dxfGroup);

    const loader = new DXFLoader();

    let frameId = null;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    mountRef.current.scene = scene;
    mountRef.current.camera = camera;
    mountRef.current.controls = controls;
    mountRef.current.loader = loader;
    mountRef.current.dxfGroup = dxfGroup;

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  const onDrop = async acceptedFiles => {
    const f = acceptedFiles[0];
    setFile(f);
    setQuote(null);
    setError(null);

    // Load DXF into Three.js scene
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target.result;
        const { scene, loader, dxfGroup, camera, controls } = mountRef.current;
        // remove old geometry
        scene.remove(dxfGroup);
        // parse and add new
        const newGroup = loader.parse(text);
        scene.add(newGroup);
        mountRef.current.dxfGroup = newGroup;

        // fit camera to object
        const box = new THREE.Box3().setFromObject(newGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.set(center.x, center.y, center.z + Math.max(size.x, size.y, size.z) * 1.2);
        controls.update();
      } catch (err) {
        console.error('3D render error:', err);
      }
    };
    reader.readAsText(f);
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
        { headers: { 'Content-Type': 'multipart/form-data' } }
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
      <h2>Quick Quote DXF (3D Viewer)</h2>

      <div
        {...getRootProps()}
        style={{ border: '2px dashed gray', padding: 20, marginBottom: 10 }}
      >
        <input {...getInputProps()} />
        {file ? <p>{file.name}</p> : <p>Drag & drop DXF here</p>}
      </div>

      {/* 3D canvas */}
      <div
        ref={mountRef}
        style={{ width: 400, height: 400, border: '1px solid #ccc', margin: 'auto' }}
      />

      <button onClick={getQuote} style={{ marginTop: 10, padding: 10 }}>
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
              <strong>Hole Ø:</strong> {quote.metrics.hole_diameters.join(', ')} mm
            </p>
          )}
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

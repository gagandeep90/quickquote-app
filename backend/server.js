const express = require('express'), multer = require('multer'), cors = require('cors');
const app = express(), upload = multer();
app.use(cors());
app.post('/api/parse-and-quote', upload.single('file'), (req, res) => {
  const m = req.body.material, q = parseInt(req.body.quantity);
  const R = { Aluminum:1.2, Steel:1.5, Brass:1.8 };
  const area=10000, path=250;
  const mat = (area/1e6) * R[m];
  const cut = path * 0.05;
  const setup = 10;
  res.json({
    materialCost: mat.toFixed(2),
    cuttingCost: cut.toFixed(2),
    setupCost: setup.toFixed(2),
    total: ((mat + cut + setup) * q).toFixed(2)
  });
});
app.listen(process.env.PORT || 3001);

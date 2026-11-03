import express from 'express'
import { listProducts,addProducts,removeProducts,singleProducts,updateStock } from '../controlers/productControler.js'
import upload from '../middleware/multer.js';
import adminAuth from '../middleware/adminAuth.js';

const productRouter = express.Router();

// Allowed upload fields: image1..image4 (classic) and colorN_front / colorN_back (up to 8 colors).
const fields = [
    ...['image1','image2','image3','image4'],
    ...Array.from({ length: 8 }, (_, i) => [`color${i}_front`, `color${i}_back`]).flat(),
].map((name) => ({ name, maxCount: 1 }));

// multer .fields() gives { name: [file] }; flatten to the list the controller expects.
const flatten = (req, _res, next) => {
    req.files = Object.values(req.files || {}).flat();
    next();
};

productRouter.post('/add',adminAuth,upload.fields(fields),flatten,addProducts);
productRouter.post('/remove',adminAuth,removeProducts);
productRouter.post('/stock',adminAuth,updateStock);
productRouter.post('/single',singleProducts);
productRouter.get('/list', listProducts);


export default productRouter

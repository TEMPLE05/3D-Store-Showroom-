import {v2 as cloudinary} from "cloudinary"
import productModel from "../models/productModel.js"

const upload = async (file) => (await cloudinary.uploader.upload(file.path, { resource_type: 'image' })).secure_url;

const parseJSON = (value, fallback) => {
    if (value === undefined || value === null || value === "") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
};

//functions for adding products
// Accepts the original fields (image1..image4, sizes) plus showroom fields:
// productType, brand, displayType, featured, model3d and colors (JSON).
// Each color's photos arrive as files named color0_front, color0_back, color1_front, ...
const addProducts = async (req,res) => {
    try {

        const {name,description, price, category, subCategory, sizes, bestseller,
            productType, brand, displayType, featured, model3d} = req.body;

        const files = {};
        (req.files || []).forEach((f) => { files[f.fieldname] = f; });

        const images = ['image1','image2','image3','image4'].map((k) => files[k]).filter(Boolean)
        let imagesUrl = await Promise.all(images.map(upload))

        const colorsIn = parseJSON(req.body.colors, []);
        const colors = await Promise.all(colorsIn.map(async (c, i) => {
            const shots = [files[`color${i}_front`], files[`color${i}_back`]].filter(Boolean);
            const urls = await Promise.all(shots.map(upload));
            return {
                name: c.name, hex: c.hex, accent: c.accent, sole: c.sole,
                images: urls,
                sizes: (c.sizes || []).map((s) => ({ size: String(s.size), stock: Math.max(0, Number(s.stock) || 0) })),
            };
        }));

        // Keep the original fields filled so the classic pages still work.
        if (!imagesUrl.length && colors[0]?.images.length) imagesUrl = colors[0].images;
        let sizeList = parseJSON(sizes, []);
        if (colors.length) sizeList = [...new Set(colors.flatMap((c) => c.sizes.map((s) => s.size)))];

        if (!imagesUrl.length) return res.json({ success: false, message: "Add at least one photo" });

        const productData = {
            name,description,category: category || "Unisex",price: Number(price),subCategory: subCategory || productType || "Other",
            bestseller: bestseller === "true" ? true : false,
            sizes: sizeList, image: imagesUrl, Date: Date.now(),
            productType: productType || undefined, brand: brand || "", colors,
            displayType: displayType || "auto", featured: featured || "", model3d: model3d || "",
        }

        const product = new productModel(productData);
        await product.save()

        res.json({success:true,message:"Product Added"})
    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message});

    }

}

//function for listing products
const listProducts = async (req,res) => {
    try {

        const products = await productModel.find({});
        res.json({success:true,products})

    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message});

    }
}

//function for removing products
const removeProducts = async (req,res) =>{

    try {

        await productModel.findByIdAndDelete(req.body.id)
        res.json({success:true,message:"Product Removed"})

    } catch (error) {
        console.log(error);
        res.json({success:false,message:error.message});

    }
}

//function for single product info
const singleProducts = async (req,res) => {
    try {

        const { productId } = req.body
        const product = await productModel.findById(productId)
        res.json({success:true,product});

    } catch (error) {
        console.log(error);
        res.json({success: false,message: error.message});
    }

}

// Update stock for one size of one color: { id, color, size, stock }
const updateStock = async (req, res) => {
    try {
        const { id, color, size, stock } = req.body;
        const product = await productModel.findById(id);
        if (!product) return res.json({ success: false, message: "Product not found" });
        const c = product.colors.find((x) => x.name === color);
        if (!c) return res.json({ success: false, message: "Color not found" });
        const s = c.sizes.find((x) => x.size === String(size));
        if (s) s.stock = Math.max(0, Number(stock) || 0);
        else c.sizes.push({ size: String(size), stock: Math.max(0, Number(stock) || 0) });
        await product.save();
        res.json({ success: true, message: "Stock updated" });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

export { listProducts,addProducts,removeProducts,singleProducts,updateStock }

import mongoose from "mongoose";

// Stock for one size in one color.
const sizeStockSchema = new mongoose.Schema({
    size: { type: String, required: true },
    stock: { type: Number, default: 0 },
}, { _id: false });

// A color variant: its own photos (front, back) and its own stock per size.
const colorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hex: { type: String, default: "#888888" },
    accent: { type: String },      // shoes: stripe / logo color, used on the mannequin
    sole: { type: String },        // shoes: sole color, used on the mannequin
    images: { type: [String], default: [] },
    sizes: { type: [sizeStockSchema], default: [] },
}, { _id: false });

const productschema = new mongoose.Schema({
    name: { type:String, required:true },
    description: { type:String, required:true },
    price: {type:Number, required:true },
    image: { type: Array, required:true },
    category: {type:String, required: true },
    subCategory: {type:String, required: true },
    sizes: {type:Array, required: true },
    bestseller: {type: Boolean},
    Date: {type:Number, required: true },

    // 3D showroom fields (all optional, so older products keep working)
    productType: { type: String, enum: ["shoes", "hoodies", "tees", "trousers", "caps", "jackets"] },
    brand: { type: String, default: "" },
    colors: { type: [colorSchema], default: [] },
    displayType: { type: String, enum: ["auto", "rail", "shelf", "wall"], default: "auto" },
    featured: { type: String, enum: ["", "head", "torso", "legs", "feet"], default: "" }, // worn by the mannequin
    model3d: { type: String, default: "" }, // optional .glb scan URL for hero items
})

const productModel = mongoose.models.product || mongoose.model("product",productschema);

export default productModel

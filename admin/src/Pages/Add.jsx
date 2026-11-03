import React, { useState } from 'react'
import { assets } from '../assets/assets'
import axios from 'axios'
import { backendUrl } from '../App'
import { toast } from 'react-toastify'

const TYPES = [
    { value: 'shoes', label: 'Shoes', sizes: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47'] },
    { value: 'hoodies', label: 'Hoodies', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { value: 'tees', label: 'Tees', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { value: 'trousers', label: 'Trousers', sizes: ['28', '30', '32', '34', '36', '38'] },
    { value: 'jackets', label: 'Jackets', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { value: 'caps', label: 'Caps', sizes: ['One size'] },
]

const FEATURE_SLOTS = [
    { value: '', label: 'Not on the mannequin' },
    { value: 'head', label: 'Head (cap)' },
    { value: 'torso', label: 'Top (hoodie, tee, jacket)' },
    { value: 'legs', label: 'Legs (trousers)' },
    { value: 'feet', label: 'Feet (shoes)' },
]

const newColor = (sizes) => ({ name: '', hex: '#151515', accent: '#ffffff', sole: '#f2f0ea', front: null, back: null, stock: Object.fromEntries(sizes.map((s) => [s, 0])) })

const input = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"

const PhotoPick = ({ id, file, onPick, label }) => (
    <label htmlFor={id} className="flex flex-col items-center gap-1 cursor-pointer">
        <span className="w-20 h-20 border border-dashed border-gray-300 rounded-md bg-gray-50 hover:border-gray-400 overflow-hidden grid place-items-center">
            <img src={file ? URL.createObjectURL(file) : assets.upload_area} alt="" className="w-full h-full object-cover" />
        </span>
        <span className="text-xs text-gray-500">{label}</span>
        <input onChange={(e) => onPick(e.target.files[0])} type="file" accept="image/*" id={id} hidden />
    </label>
)

const Add = ({ token }) => {

    const [productType, setProductType] = useState('shoes')
    const typeInfo = TYPES.find((t) => t.value === productType)

    const [name, setName] = useState("");
    const [brand, setBrand] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [category, setCategory] = useState("Unisex");
    const [bestseller, setBestseller] = useState(false);
    const [featured, setFeatured] = useState("");
    const [colors, setColors] = useState([newColor(typeInfo.sizes)]);
    const [saving, setSaving] = useState(false);

    const changeType = (value) => {
        setProductType(value)
        const sizes = TYPES.find((t) => t.value === value).sizes
        setColors((prev) => prev.map((c) => ({ ...c, stock: Object.fromEntries(sizes.map((s) => [s, c.stock[s] || 0])) })))
    }
    const updateColor = (i, patch) => setColors((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)))
    const updateStock = (i, size, value) => setColors((prev) => prev.map((c, j) => (j === i ? { ...c, stock: { ...c.stock, [size]: value } } : c)))

    const reset = () => {
        setName(''); setBrand(''); setDescription(''); setPrice(''); setFeatured(''); setBestseller(false)
        setColors([newColor(typeInfo.sizes)])
    }

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        if (colors.some((c) => !c.name.trim())) { toast.error("Give every color a name, e.g. Black"); return }
        if (!colors[0].front) { toast.error("Add a front photo for the first color"); return }

        try {
            setSaving(true)
            const formData = new FormData()
            formData.append("name", name)
            formData.append("brand", brand)
            formData.append("description", description)
            formData.append("price", price)
            formData.append("category", category)
            formData.append("subCategory", productType)
            formData.append("productType", productType)
            formData.append("featured", featured)
            formData.append("bestseller", bestseller)
            formData.append("colors", JSON.stringify(colors.map((c) => ({
                name: c.name.trim(), hex: c.hex,
                ...(productType === 'shoes' ? { accent: c.accent, sole: c.sole } : {}),
                sizes: typeInfo.sizes.map((s) => ({ size: s, stock: Number(c.stock[s]) || 0 })),
            }))))
            colors.forEach((c, i) => {
                c.front && formData.append(`color${i}_front`, c.front)
                c.back && formData.append(`color${i}_back`, c.back)
            })

            const response = await axios.post(backendUrl + "/api/products/add", formData, { headers: { token } })

            if (response.data.success) {
                toast.success(response.data.message)
                reset()
            } else {
                toast.error(response.data.message)
            }
        } catch (error) {
            console.log(error);
            toast.error(error.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={onSubmitHandler} className="flex flex-col w-full items-start gap-6 p-4 sm:p-6 max-w-3xl mx-auto">

            {/* Type */}
            <div className="w-full">
                <p className="mb-2 text-gray-700">What are you adding?</p>
                <div className="flex gap-2 flex-wrap">
                    {TYPES.map((t) => (
                        <button type="button" key={t.value} onClick={() => changeType(t.value)}
                            className={`px-4 py-2 rounded-full text-sm border transition ${productType === t.value ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-500'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Name / Brand */}
            <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="flex-1">
                    <p className="mb-2 text-gray-700">Product name</p>
                    <input onChange={(e) => setName(e.target.value)} value={name} className={input} type="text" placeholder="e.g. Runner Low" required />
                </div>
                <div className="flex-1">
                    <p className="mb-2 text-gray-700">Brand {productType === 'shoes' ? '(shoes are grouped by brand)' : '(optional)'}</p>
                    <input onChange={(e) => setBrand(e.target.value)} value={brand} className={input} type="text" placeholder="e.g. your shop's own label" required={productType === 'shoes'} />
                </div>
            </div>

            {/* Description */}
            <div className="w-full">
                <p className="mb-2 text-gray-700">Description</p>
                <textarea onChange={(e) => setDescription(e.target.value)} value={description} className={`${input} resize-none`} rows={3} placeholder="Material, fit, how it wears" required />
            </div>

            {/* Price / Category / Mannequin */}
            <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="flex-1">
                    <p className="mb-2 text-gray-700">Price (₦)</p>
                    <input onChange={(e) => setPrice(e.target.value)} value={price} className={input} type="number" min="0" placeholder="45000" required />
                </div>
                <div className="flex-1">
                    <p className="mb-2 text-gray-700">For</p>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                        {['Unisex', 'Men', 'Women', 'Kids'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex-1">
                    <p className="mb-2 text-gray-700">Wear on the mannequin</p>
                    <select value={featured} onChange={(e) => setFeatured(e.target.value)} className={input}>
                        {FEATURE_SLOTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Colors */}
            <div className="w-full grid gap-4">
                <div>
                    <p className="text-gray-700">Colors and stock</p>
                    <p className="text-xs text-gray-500 mt-1">Take photos on a plain background. Front photo is required; a back photo lets customers turn the item around.</p>
                </div>
                {colors.map((c, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 grid gap-4 bg-white">
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[140px]">
                                <p className="mb-1 text-sm text-gray-600">Color name</p>
                                <input value={c.name} onChange={(e) => updateColor(i, { name: e.target.value })} className={input} placeholder="Black" />
                            </div>
                            <label className="text-sm text-gray-600 flex flex-col gap-1">Main
                                <input type="color" value={c.hex} onChange={(e) => updateColor(i, { hex: e.target.value })} className="h-10 w-14 border rounded" />
                            </label>
                            {productType === 'shoes' && <>
                                <label className="text-sm text-gray-600 flex flex-col gap-1">Stripe
                                    <input type="color" value={c.accent} onChange={(e) => updateColor(i, { accent: e.target.value })} className="h-10 w-14 border rounded" />
                                </label>
                                <label className="text-sm text-gray-600 flex flex-col gap-1">Sole
                                    <input type="color" value={c.sole} onChange={(e) => updateColor(i, { sole: e.target.value })} className="h-10 w-14 border rounded" />
                                </label>
                            </>}
                            {colors.length > 1 && (
                                <button type="button" onClick={() => setColors((prev) => prev.filter((_, j) => j !== i))} className="text-sm text-red-600 px-2 py-2">Remove</button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <PhotoPick id={`c${i}f`} file={c.front} onPick={(f) => updateColor(i, { front: f })} label={productType === 'shoes' ? 'Right side' : 'Front'} />
                            <PhotoPick id={`c${i}b`} file={c.back} onPick={(f) => updateColor(i, { back: f })} label={productType === 'shoes' ? 'Left side' : 'Back'} />
                        </div>
                        <div>
                            <p className="mb-2 text-sm text-gray-600">How many in stock per size</p>
                            <div className="flex flex-wrap gap-2">
                                {typeInfo.sizes.map((s) => (
                                    <label key={s} className="flex flex-col items-center text-xs text-gray-600 gap-1">
                                        {s}
                                        <input type="number" min="0" value={c.stock[s] ?? 0} onChange={(e) => updateStock(i, s, e.target.value)}
                                            className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-center text-sm" />
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
                {colors.length < 8 && (
                    <button type="button" onClick={() => setColors((prev) => [...prev, newColor(typeInfo.sizes)])}
                        className="justify-self-start text-sm border border-gray-300 rounded-md px-4 py-2 hover:border-gray-500">+ Add another color</button>
                )}
            </div>

            {/* Bestseller */}
            <div className="flex gap-2 items-center">
                <input onChange={() => setBestseller((prev) => !prev)} checked={bestseller} type="checkbox" id="bestseller" className="accent-black" />
                <label htmlFor="bestseller" className="cursor-pointer text-gray-700">Show in best sellers</label>
            </div>

            <button type="submit" disabled={saving}
                className="bg-black hover:bg-gray-900 disabled:opacity-50 text-white rounded-md px-5 py-3 transition-all shadow-md w-full max-w-[200px] text-center">
                {saving ? 'Uploading…' : 'Add product'}
            </button>
        </form>
    )
}

export default Add

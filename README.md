# 3D Store Showroom

A phone-first 3D online store for clothing boutiques. Customers land on a black mannequin under a shop spotlight wearing this week's look, browse categories from a side menu, pick shoes by brand from a lit shelf wall, swipe along clothing rails, filter by color and size, and order by cart or WhatsApp.

Built on the [E-Store](https://github.com/TEMPLE05/E-Store) codebase (React + Vite storefront, admin panel, Node/Express/MongoDB backend, Cloudinary images).

## What's in the showroom

| Screen | What it does |
| --- | --- |
| Home | Posable black mannequin (Standing, Hand on hip, Mid-step, Relaxed) wearing the featured cap, top, trousers and shoes. Drag to turn it; tap a glowing dot or a worn item to open it. Shop-the-look list, best sellers and category tiles below. |
| Side menu | Categories with item counts, cart, sign in, classic store view, WhatsApp number. |
| Shoes | Brand tiles first, then that brand's shelf wall: 2 pairs per shelf on phones, more on wider screens. |
| Hoodies, tees, trousers, jackets | A clothing rail you swipe along; the front piece faces you, the rest turn edge-on. A plain grid of everything sits underneath. |
| Caps | A lit wall of cubbies. |
| Color and size filters | Chips stuck under the top bar. Items without that color or size in stock slide off the display, the rest close up, and every item switches to the chosen color. |
| Product panel | Spin the item, pick a color (photos change) and a size (sold-out sizes are crossed out, "Only 2 left" shows when low), add to cart or order on WhatsApp with the details filled in. |

How items are shown in 3D:
- **Tees, hoodies, jackets, trousers:** a garment shape with the product's front photo on the front and back photo on the back.
- **Shoes and caps:** turning cards, a cut-out photo with front and back (for shoes, right side and left side).
- **Older products** without colors (from the original E-Store) still appear, shown as photo cards.

## Demo stock

When the backend is unreachable or has no products, the store shows a built-in demo boutique, **ASO Studio**, with 30 items: 13 shoes across 4 invented brands (Volta, Kairo, Zuri, Northline), hoodies, tees, trousers and caps, each with colors and stock per size. All product art is generated in code (`my-ecommerce-store/src/showroom/art.js`), so nothing needs to be downloaded. Turn it off with `VITE_DEMO_CATALOG=false`.

## Settings (storefront `.env`)

```
VITE_BACKEND_URL=http://localhost:4000
VITE_STORE_NAME=ASO Studio
VITE_STORE_TAGLINE=Streetwear · Abuja
VITE_WHATSAPP_NUMBER=2348012345678     # international format, digits only
VITE_FEATURED_POSE=hip                 # standing | hip | step | relaxed
VITE_CURRENCY=₦
VITE_DELIVERY_FEE=2500
VITE_DEMO_CATALOG=true
```

## Adding a boutique's real stock

In the admin panel, **Add product** now asks for:
- product type (shoes, hoodies, tees, trousers, jackets, caps)
- brand (shoes are grouped by brand)
- which part of the mannequin wears it (head, top, legs, feet), if any
- one or more colors, each with a name, swatch color, front and back photos, and how many are in stock per size

Photo tips: plain light background, item laid flat or on a hanger, straight on. For shoes, shoot the right side and the left side.

Stock for one size of one color can be changed with `POST /api/products/stock` `{ id, color, size, stock }` (admin token required).

## Run it

```bash
cd backend && npm install && npm run server          # needs MONGODB_URI, CLOUDINARY_*, JWT_SECRET, ADMIN_* in backend/.env
cd my-ecommerce-store && npm install && npm run dev  # storefront
cd admin && npm install && npm run dev               # admin panel
```

The storefront also runs on its own (no backend) using the demo stock, which is handy for showing boutiques.

## Code map

```
my-ecommerce-store/src/showroom/
  ShowroomLayout.jsx     top bar, categories menu, product panel
  pages/                 home, category (brand tiles, rail, cap wall), shoe shelf
  components/            product card, filter bar, product panel
  three/Mannequin.jsx    posable mannequin and its outfit
  three/poses.js         pose library (joint angles)
  three/ShopLights.jsx   spotlight with visible cone, rim lights, floor pool, soft shadow
  three/ShelfScene.jsx   shoe and cap wall
  three/RailScene.jsx    clothing rail
  three/ItemViewer.jsx   spin view inside the product panel
  catalog.js             demo boutique, categories, shoe brands
  art.js                 generated product art and brand marks
```

## Not built yet

- Real 3D scans for hero shoes: products have a `model3d` field ready, but the viewer does not load `.glb` files yet.
- Customers dressing the mannequin themselves (planned as phase 2).
- Paystack card payments.
- One install serves one boutique; each new client gets their own copy and database.

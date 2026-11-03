import React from 'react';
import { Routes, Route, Outlet } from 'react-router-dom';
import Collection from './pages/Collection';
import About from './pages/About';
import Orders from './pages/Orders';
import Contact from './pages/Contact';
import PlaceOrder from './pages/PlaceOrder';
import Profile from './pages/profile';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Product from './pages/Product';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Searchbar from './components/Searchbar';
import ScrollToTop from './components/ScrollToTop';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ShowroomLayout from './showroom/ShowroomLayout';
import ShowroomHome from './showroom/pages/ShowroomHome';
import CategoryPage, { ShoeShelf } from './showroom/pages/CategoryPage';

// The original store pages: cart, checkout, account, classic product list.
const ClassicLayout = () => (
  <div className="w-full">
    <Navbar />
    <Searchbar />
    <div className="px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]">
      <ToastContainer />
      <Outlet />
      <Footer />
    </div>
  </div>
);

const App = () => (
  <>
    <ScrollToTop />
    <Routes>
      {/* 3D showroom */}
      <Route element={<ShowroomLayout />}>
        <Route path="/" element={<ShowroomHome />} />
        <Route path="/shop/shoes/:brand" element={<ShoeShelf />} />
        <Route path="/shop/:category" element={<CategoryPage />} />
      </Route>
      <Route element={<ClassicLayout />}>
        <Route path="/collection" element={<Collection />} />
        <Route path="/about" element={<About />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/place-order" element={<PlaceOrder />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/product/:productId" element={<Product />} />
      </Route>
    </Routes>
  </>
);

export default App;

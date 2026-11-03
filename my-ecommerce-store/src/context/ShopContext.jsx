import React, { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DEMO_PRODUCTS } from "../showroom/catalog";

export const ShopContext = createContext();

// Demo stock shows when the backend is unreachable or empty. Set VITE_DEMO_CATALOG=false to turn it off.
const DEMO_ENABLED = import.meta.env.VITE_DEMO_CATALOG !== "false";

const ShopContextProvider = (props) => {
  const currency = import.meta.env.VITE_CURRENCY || "₦";
  const delivery_fee = Number(import.meta.env.VITE_DELIVERY_FEE || 2500);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

  // Create axios instance with retry logic
  const api = axios.create({
    baseURL: backendUrl,
    timeout: 10000, // 10 seconds
  });

  // Request interceptor for adding token
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.token = token;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor with retry logic
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config, response } = error;
      const maxRetries = config?.retryLimit ?? 3;
      const retryDelay = 1000; // 1 second

      if (!config || !config.retry) {
        config.retry = 0;
      }

      // Retry on network errors, timeouts, or 5xx server errors
      if (
        config.retry < maxRetries &&
        (!response || response.status >= 500 || error.code === 'ECONNABORTED')
      ) {
        config.retry += 1;
        console.log(`Retrying request (${config.retry}/${maxRetries}): ${config.url}`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * config.retry));

        return api(config);
      }

      // If still failing after retries, show error
      if (DEMO_ENABLED && config.url?.includes('/api/products/list')) {
        // Demo catalog covers this; no need to alarm the visitor.
      } else if (response?.status >= 500) {
        toast.error("Server is temporarily unavailable. Please try again.");
      } else if (error.code === 'ECONNABORTED') {
        toast.error("Request timed out. Please check your connection.");
      }

      return Promise.reject(error);
    }
  );
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cartItems, setCartItems] = useState({});
  const [products, setProducts] = useState(DEMO_ENABLED ? DEMO_PRODUCTS : []);
  const [orders, setOrders] = useState([]);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const navigate = useNavigate();

  /* =======================
     Product & user-data fetchers
     ======================= */

  const getProductData = async () => {
    try {
      const res = await api.get('/api/products/list', { retryLimit: DEMO_ENABLED ? 0 : 3 });
      const list = res.data?.products || [];
      setProducts(list.length || !DEMO_ENABLED ? list : DEMO_PRODUCTS);
    } catch (err) {
      console.error("getProductData:", err);
      if (DEMO_ENABLED) setProducts(DEMO_PRODUCTS);
      else toast.error("Failed to fetch products.");
    }
  };

  const getUserCart = async (authToken) => {
    if (!authToken) return;
    try {
      const res = await api.post('/api/cart/get');
      if (res.data?.success) setCartItems(res.data.cartData || {});
    } catch (err) {
      console.error("getUserCart:", err);
      toast.error("Failed to fetch user cart.");
    }
  };

  const getUserOrders = async (authToken) => {
    if (!authToken) return;

    try {
      const res = await api.post('/api/order/userOrders');

      if (res.data?.success) {
        setOrders(res.data.orders || []);
      } else {
        console.warn("getUserOrders: backend returned no success flag", res.data);
      }
    } catch (err) {
      console.error("getUserOrders:", err.message || err);

      if (authToken && orders.length > 0) {
        toast.error("Failed to fetch user orders.");
      }
    }
  };

  /* =======================
     Guest Cart Functions
     ======================= */

  const getGuestCart = () => {
    try {
      const guestCart = localStorage.getItem("guestCart");
      return guestCart ? JSON.parse(guestCart) : {};
    } catch (error) {
      console.error("Error parsing guest cart:", error);
      return {};
    }
  };

  const saveGuestCart = (cartData) => {
    try {
      localStorage.setItem("guestCart", JSON.stringify(cartData));
    } catch (error) {
      console.error("Error saving guest cart:", error);
    }
  };

  const mergeGuestCartWithUser = async (authToken) => {
    const guestCart = getGuestCart();
    
    if (!authToken || Object.keys(guestCart).length === 0) {
      return;
    }

    try {
      const res = await api.post('/api/cart/merge', { guestCart });

      if (res.data?.success) {
        // Update local cart state with merged cart
        setCartItems(res.data.cartData || {});
        // Clear guest cart from localStorage
        localStorage.removeItem("guestCart");
        console.log("Guest cart merged successfully");
      }
    } catch (err) {
      console.error("mergeGuestCartWithUser:", err);
      toast.error("Failed to merge guest cart.");
    }
  };

  /* =======================
     Cart helpers
     ======================= */

  const addToCart = async (itemId, size) => {
    if (!size) {
      toast.error("Please select product size");
      return;
    }

    // Update local cart state immediately for better UX
    const cartData = structuredClone(cartItems);
    if (!cartData[itemId]) cartData[itemId] = {};
    cartData[itemId][size] = (cartData[itemId][size] || 0) + 1;
    setCartItems(cartData);

    if (token) {
      // User is logged in - update server cart
      try {
        await api.post('/api/cart/add', { itemId, size });
      } catch (err) {
        console.error("addToCart:", err);
        toast.error("Failed to update cart on server.");
        // Revert local state on error
        const revertedCart = structuredClone(cartItems);
        setCartItems(revertedCart);
      }
    } else {
      // Guest user - save to localStorage
      saveGuestCart(cartData);
    }
  };

  const updateQuantity = async (itemId, size, quantity) => {
    // Update local cart state immediately
    const cartData = structuredClone(cartItems);
    if (!cartData[itemId]) cartData[itemId] = {};
    
    if (quantity <= 0) {
      delete cartData[itemId][size];
      if (Object.keys(cartData[itemId]).length === 0) {
        delete cartData[itemId];
      }
    } else {
      cartData[itemId][size] = quantity;
    }
    
    setCartItems(cartData);

    if (token) {
      // User is logged in - update server cart
      try {
        await api.post('/api/cart/update', { itemId, size, quantity });
      } catch (err) {
        console.error("updateQuantity:", err);
        toast.error("Failed to update quantity on server.");
        // Revert local state on error
        const revertedCart = structuredClone(cartItems);
        setCartItems(revertedCart);
      }
    } else {
      // Guest user - save to localStorage
      saveGuestCart(cartData);
    }
  };

  const getCartCount = () => {
    let totalCount = 0;
    for (const itemId in cartItems) {
      for (const size in cartItems[itemId]) {
        const qty = cartItems[itemId][size] || 0;
        totalCount += qty;
      }
    }
    return totalCount;
  };

  const getCartAmount = () => {
    let totalAmount = 0;
    for (const itemId in cartItems) {
      const itemInfo = products.find((p) => p._id === itemId);
      if (!itemInfo) continue;
      for (const size in cartItems[itemId]) {
        const qty = cartItems[itemId][size] || 0;
        if (qty > 0) totalAmount += itemInfo.price * qty;
      }
    }
    return totalAmount;
  };

  // Function to redirect guest users to login when they try to checkout
  const handleGuestCheckout = () => {
    if (!token) {
      toast.info("Please login to proceed with checkout");
      navigate("/login");
      return false;
    }
    return true;
  };

  /* =======================
     Effects: load data & persist token
     ======================= */

  // Load products and guest cart on mount
  useEffect(() => {
    getProductData();

    // Load guest cart if no token
    if (!token) {
      const guestCart = getGuestCart();
      setCartItems(guestCart);
    }
  }, []);

  // Handle token changes (login/logout)
  useEffect(() => {
    if (token) {
      // User logged in - merge guest cart and load user data
      mergeGuestCartWithUser(token);
      getUserOrders(token);
      getProductData(); // Refresh products
    } else {
      // User logged out - clear user data and load guest cart
      setOrders([]);
      const guestCart = getGuestCart();
      setCartItems(guestCart);
    }
  }, [token]);

  // Persist token
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  /* =======================
     Context value
     ======================= */

  const value = {
    products,
    currency,
    delivery_fee,
    search,
    setSearch,
    showSearch,
    setShowSearch,
    cartItems,
    orders,
    addToCart,
    getCartCount,
    updateQuantity,
    getCartAmount,
    navigate,
    backendUrl,
    setToken,
    token,
    setCartItems,
    handleGuestCheckout, // New function for checkout flow
    getProductData,
    getUserCart,
    getUserOrders,
  };

  return <ShopContext.Provider value={value}>{props.children}</ShopContext.Provider>;
};

export default ShopContextProvider;
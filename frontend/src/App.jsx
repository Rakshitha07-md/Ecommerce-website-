
import { useEffect, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [token, setToken] = useState(
    () => localStorage.getItem("shopEasyToken") || ""
  );

  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem("shopEasyUser") || "null")
  );

  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showOrders, setShowOrders] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productMessage, setProductMessage] = useState("");

  const emptyProduct = {
    name: "",
    description: "",
    price: "",
    image: "",
    category: "",
    stock: "",
  };

  const [productForm, setProductForm] = useState(emptyProduct);

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API}/products`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch products");
      }

      setProducts(Array.isArray(data) ? data : data.products || []);
    } catch (err) {
      console.error(err);
      setError("Could not load products. Please check the backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Register and login
  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthLoading(true);

    try {
      const endpoint =
        authMode === "login" ? "/auth/login" : "/auth/register";

      const body =
        authMode === "login"
          ? { email, password }
          : { name, email, password };

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (authMode === "register") {
        setAuthMessage("Registration successful! Please log in.");
        setAuthMode("login");
        setPassword("");
      } else {
        const receivedToken = data.token || data.accessToken;

        if (!receivedToken) {
          throw new Error("No token returned by the backend.");
        }

        localStorage.setItem("shopEasyToken", receivedToken);
        setToken(receivedToken);

        if (data.user) {
          localStorage.setItem(
            "shopEasyUser",
            JSON.stringify(data.user)
          );
          setUser(data.user);
        } else {
          setUser(null);
        }

        setPassword("");
        setAuthMessage("");
      }
    } catch (err) {
      setAuthError(err.message || "Could not connect to backend.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("shopEasyToken");
    localStorage.removeItem("shopEasyUser");

    setToken("");
    setUser(null);
    setCart([]);
    setOrders([]);
    setShowOrders(false);
    setShowAdmin(false);
    setEditingProductId(null);
    setProductMessage("");
    setAuthMode("login");
    setAuthMessage("You have logged out.");
  };

  // Add product to cart
  const addToCart = (product) => {
    setCart((previousCart) => {
      const existing = previousCart.find(
        (item) => item._id === product._id
      );

      const currentQuantity = existing ? existing.quantity : 0;

      if (currentQuantity >= product.stock) {
        alert("Sorry, no more stock available!");
        return previousCart;
      }

      if (existing) {
        return previousCart.map((item) =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...previousCart, { ...product, quantity: 1 }];
    });
  };

  // Remove cart item
  const removeFromCart = (productId) => {
    setCart((previousCart) =>
      previousCart.filter((item) => item._id !== productId)
    );
  };

  // Change quantity
  const changeQuantity = (productId, change) => {
    setCart((previousCart) =>
      previousCart.map((item) => {
        if (item._id !== productId) return item;

        const newQuantity = item.quantity + change;

        if (newQuantity < 1) return item;

        if (newQuantity > item.stock) {
          alert("Sorry, no more stock available!");
          return item;
        }

        return { ...item, quantity: newQuantity };
      })
    );
  };

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Checkout
  const checkout = async () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    const shippingAddress = window.prompt(
      "Enter your complete shipping address:"
    );

    if (!shippingAddress || !shippingAddress.trim()) {
      alert("Shipping address is required.");
      return;
    }

    try {
      const response = await fetch(`${API}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
          })),
          shippingAddress: shippingAddress.trim(),
        }),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        logout();
        alert("Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not place order.");
      }

      alert("Order placed successfully!");
      setCart([]);
      await fetchProducts();

      if (showOrders) {
        await fetchOrders();
      }
    } catch (err) {
      alert(err.message || "Could not connect to backend.");
    }
  };

  // Fetch my orders
  const fetchOrders = async () => {
    setOrdersLoading(true);

    try {
      const response = await fetch(`${API}/orders/my-orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        logout();
        throw new Error("Please log in again.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not load orders.");
      }

      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch (err) {
      alert(err.message || "Could not load order history.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const openOrders = async () => {
    setShowAdmin(false);
    setShowOrders(true);
    await fetchOrders();
  };

  // Reset product form
  const resetProductForm = () => {
    setProductForm({ ...emptyProduct });
    setEditingProductId(null);
  };

  // Product form inputs
  const handleProductFormChange = (event) => {
    const { name, value } = event.target;

    setProductForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Add or update product
  const saveProduct = async (event) => {
    event.preventDefault();
    setProductMessage("");

    try {
      const response = await fetch(
        editingProductId
          ? `${API}/products/${editingProductId}`
          : `${API}/products`,
        {
          method: editingProductId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...productForm,
            price: Number(productForm.price),
            stock: Number(productForm.stock),
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          data.message || "Admin access required. Please log in again if needed."
        );
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not save product.");
      }

      setProductMessage(
        editingProductId
          ? "Product updated successfully!"
          : "Product added successfully!"
      );

      resetProductForm();
      await fetchProducts();
    } catch (err) {
      setProductMessage(err.message);
    }
  };

  // Select product for editing
  const editProduct = (product) => {
    setProductForm({
      name: product.name || "",
      description: product.description || "",
      price: String(product.price ?? ""),
      image: product.image || "",
      category: product.category || "",
      stock: String(product.stock ?? ""),
    });

    setEditingProductId(product._id);
    setShowAdmin(true);
    setShowOrders(false);
    setProductMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete product
  const deleteProduct = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      const response = await fetch(`${API}/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        throw new Error(data.message || "Admin access required.");
      }

      if (!response.ok) {
        throw new Error(data.message || "Could not delete product.");
      }

      setProductMessage("Product deleted successfully!");
      await fetchProducts();
    } catch (err) {
      setProductMessage(err.message);
    }
  };

  // Login and registration screen
  if (!token) {
    return (
      <div className="app">
        <header className="navbar">
          <h1>🛍️ ShopEasy</h1>
        </header>

        <main>
          <section className="auth-section">
            <h2>
              {authMode === "login"
                ? "Welcome Back!"
                : "Create Your Account"}
            </h2>

            <p>
              {authMode === "login"
                ? "Log in to continue shopping."
                : "Register to start shopping with ShopEasy."}
            </p>

            {authError && <p className="error">{authError}</p>}
            {authMessage && <p>{authMessage}</p>}

            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === "register" && (
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button type="submit" disabled={authLoading}>
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Login"
                  : "Register"}
              </button>
            </form>

            <p>
              {authMode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}

              <button
                type="button"
                onClick={() => {
                  setAuthMode(
                    authMode === "login" ? "register" : "login"
                  );
                  setAuthError("");
                  setAuthMessage("");
                }}
              >
                {authMode === "login" ? "Register here" : "Login here"}
              </button>
            </p>
          </section>
        </main>

        <footer>
          <p>© 2026 ShopEasy | E-Commerce Web Application</p>
        </footer>
      </div>
    );
  }

  // Main application
  return (
    <div className="app">
      <header className="navbar">
        <h1>🛍️ ShopEasy</h1>

        <nav>
          <a href="#home" onClick={() => {
            setShowOrders(false);
            setShowAdmin(false);
          }}>Home</a>

          <a href="#products" onClick={() => {
            setShowOrders(false);
            setShowAdmin(false);
          }}>Products</a>

          <a href="#cart" onClick={() => {
            setShowOrders(false);
            setShowAdmin(false);
          }}>Cart ({cartCount})</a>

          <button onClick={openOrders}>My Orders</button>

          {user?.role === "admin" && (
            <button onClick={() => {
              setShowAdmin(true);
              setShowOrders(false);
              setProductMessage("");
            }}>
              Admin Dashboard
            </button>
          )}

          <button onClick={logout}>Logout</button>
        </nav>
      </header>

      <section className="hero" id="home">
        <h2>Welcome to ShopEasy!</h2>
        <p>Discover amazing products at great prices.</p>
        <a
          className="shop-button"
          href="#products"
          onClick={() => {
            setShowOrders(false);
            setShowAdmin(false);
          }}
        >
          Shop Now
        </a>
      </section>

      <main>
        {showAdmin && user?.role === "admin" ? (
          <section className="admin-section">
            <h2>👑 Admin Dashboard</h2>
            <p>Manage your store products here.</p>

            <form className="auth-form admin-form" onSubmit={saveProduct}>
              <h3>
                {editingProductId ? "Edit Product" : "Add New Product"}
              </h3>

              <input
                name="name"
                placeholder="Product name"
                value={productForm.name}
                onChange={handleProductFormChange}
                required
              />

              <input
                name="description"
                placeholder="Product description"
                value={productForm.description}
                onChange={handleProductFormChange}
                required
              />

              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="Price (₹)"
                value={productForm.price}
                onChange={handleProductFormChange}
                required
              />

              <input
                name="image"
                type="url"
                placeholder="Image URL (optional)"
                value={productForm.image}
                onChange={handleProductFormChange}
              />

              <input
                name="category"
                placeholder="Category (e.g. Electronics)"
                value={productForm.category}
                onChange={handleProductFormChange}
                required
              />

              <input
                name="stock"
                type="number"
                min="0"
                step="1"
                placeholder="Available stock"
                value={productForm.stock}
                onChange={handleProductFormChange}
                required
              />

              <button type="submit">
                {editingProductId ? "Update Product" : "Add Product"}
              </button>

              {editingProductId && (
                <button type="button" onClick={resetProductForm}>
                  Cancel Edit
                </button>
              )}
            </form>

            {productMessage && (
              <p
                className={
                  productMessage.toLowerCase().includes("successfully")
                    ? "success-message"
                    : "error"
                }
              >
                {productMessage}
              </p>
            )}

            <h3>Manage Products ({products.length})</h3>

            {loading && <p>Loading products...</p>}

            <div className="product-grid">
              {products.map((product) => (
                <div className="product-card" key={product._id}>
                  <img
                    src={
                      product.image ||
                      "https://placehold.co/300x200?text=ShopEasy"
                    }
                    alt={product.name}
                  />
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <p>Category: {product.category}</p>
                  <h3 className="price">₹{product.price}</h3>
                  <p>Stock: {product.stock}</p>

                  <button onClick={() => editProduct(product)}>
                    ✏️ Edit
                  </button>

                  <button
                    className="delete-product-button"
                    onClick={() => deleteProduct(product._id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>

            <button
              className="checkout-button"
              onClick={() => setShowAdmin(false)}
            >
              Back to Shop
            </button>
          </section>
        ) : showOrders ? (
          <section className="orders-section">
            <h2>📦 My Orders</h2>

            <button onClick={() => setShowOrders(false)}>
              Back to Shop
            </button>

            {ordersLoading && <p>Loading your orders...</p>}

            {!ordersLoading && orders.length === 0 && (
              <p>You haven't placed any orders yet.</p>
            )}

            {!ordersLoading &&
              orders.map((order) => (
                <div className="cart-item" key={order._id}>
                  <div>
                    <h3>Order #{order._id}</h3>
                    <p>Status: {order.status}</p>
                    <p>Shipping address: {order.shippingAddress}</p>
                    <p>Total: ₹{order.totalAmount}</p>
                    <p>
                      Items:{" "}
                      {order.items
                        ?.map(
                          (item) =>
                            `${item.name || item.product?.name || "Product"} × ${item.quantity}`
                        )
                        .join(", ")}
                    </p>
                  </div>
                </div>
              ))}
          </section>
        ) : (
          <>
            <section id="products">
              <h2>Our Products</h2>

              {loading && <p>Loading products...</p>}
              {error && <p className="error">{error}</p>}

              {!loading && !error && products.length === 0 && (
                <p>No products available yet.</p>
              )}

              <div className="product-grid">
                {products.map((product) => (
                  <div className="product-card" key={product._id}>
                    <img
                      src={
                        product.image ||
                        "https://placehold.co/300x200?text=ShopEasy"
                      }
                      alt={product.name}
                    />
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <h3 className="price">₹{product.price}</h3>
                    <p>Available stock: {product.stock}</p>

                    <button
                      disabled={product.stock <= 0}
                      onClick={() => addToCart(product)}
                    >
                      {product.stock > 0 ? "Add to Cart" : "Out of Stock"}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section id="cart" className="cart-section">
              <h2>🛒 Your Shopping Cart</h2>

              {cart.length === 0 ? (
                <p>Your cart is empty. Add some products!</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div className="cart-item" key={item._id}>
                      <div>
                        <h3>{item.name}</h3>
                        <p>
                          ₹{item.price} × {item.quantity} = ₹
                          {item.price * item.quantity}
                        </p>
                      </div>

                      <div className="quantity-controls">
                        <button onClick={() => changeQuantity(item._id, -1)}>
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => changeQuantity(item._id, 1)}>
                          +
                        </button>
                        <button
                          className="remove-button"
                          onClick={() => removeFromCart(item._id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="cart-total">
                    <h3>Total Items: {cartCount}</h3>
                    <h2>Total Amount: ₹{cartTotal}</h2>
                    <button className="checkout-button" onClick={checkout}>
                      Place Order
                    </button>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </main>

      <footer>
        <p>© 2026 ShopEasy | E-Commerce Web Application</p>
      </footer>
    </div>
  );
}

export default App;

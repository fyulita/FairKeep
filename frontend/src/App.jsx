import { useEffect, useState } from "react";
import api from "./api/axiosConfig";
import './styles.css';

function Navbar() {
    return (
      <nav className="navbar">
        <h2 style={{ color: 'white', textAlign: 'center', margin: 0 }}>Expense Tracker</h2>
      </nav>
    );
}

function Footer() {
  return (
    <footer className="footer">
      <p>© 2024 Expense Tracker. All rights reserved.</p>
    </footer>
  );
}

function Login({ setIsLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/token/", { username, password });
      const { access, refresh } = response.data;
  
      // Save the tokens
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);
  
      setIsLoggedIn(true); // Update login state
    } catch (error) {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="main-container">
      <h1>Login</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleLogin} className="login-form">
        <div>
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

function Expenses({ logout }) {
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const response = await api.get("/expenses/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setExpenses(response.data);
      } catch (error) {
        console.error("Error fetching expenses:", error);
      }
    };

    fetchExpenses();
  }, []);

  return (
    <div className="main-container">
      <Navbar />
      <button onClick={logout} style={{ marginTop: "10px" }}>
        Logout
      </button>
      <h1>Expenses</h1>
      <div className="expense-container">
        {expenses.map((expense) => (
          <div key={expense.id} className="expense-item">
            <span>{expense.name}</span>
            <span className="expense-amount">${expense.amount}</span>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const refresh = localStorage.getItem("refreshToken");
        if (!refresh) {
          logout(); // No refresh token available
          return;
        }
  
        const response = await api.post("/token/refresh/", { refresh });
        localStorage.setItem("accessToken", response.data.access);
      } catch (error) {
        console.error('Error refreshing token or refresh token expired:', error);
        logout(); // Logout if refreshing fails
      }
    };
  
    const interval = setInterval(refreshToken, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const logout = () => {
    localStorage.removeItem("accessToken");
    setIsLoggedIn(false);
  };

  return isLoggedIn ? (
    <Expenses logout={logout} />
  ) : (
    <Login setIsLoggedIn={setIsLoggedIn} />
  );
}

export default App;
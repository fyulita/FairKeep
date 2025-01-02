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
      <p>© 2025 Expense Tracker. All rights reserved.</p>
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
      // Fetch CSRF token
      await api.get("csrf/");

      const response = await api.post("login/", { username, password });
      if (response.status === 200) setIsLoggedIn(true);
    } catch (error) {
      console.error("Login Failed: ", error);
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
        const response = await api.get("expenses/");
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

  // Check session on page load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await api.get("check-session/");
        if (response.data.authenticated) {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.log("Session expired or not logged in");
        setIsLoggedIn(false);
      }
    };
    checkSession();
  }, []);

  const logout = async () => {
    try {
      await api.post("logout/", {});
      setIsLoggedIn(false);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return isLoggedIn ? (
    <Expenses logout={logout} />
  ) : (
    <Login setIsLoggedIn={setIsLoggedIn} />
  );
}

export default App;
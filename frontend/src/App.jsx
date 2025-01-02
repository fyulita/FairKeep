import { useState, useEffect } from "react";
import api from "./api/axiosConfig";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Login from "./components/Login";
import Expenses from "./components/Expenses";
import Balances from "./components/Balances";
import './styles.css';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const response = await api.get("check-session/");
                setIsLoggedIn(response.data.authenticated);
            } catch {
                setIsLoggedIn(false);
            } finally {
                setLoading(false);
            }
        };
        checkSession();
    }, []);

    const logout = async () => {
        try {
            await api.post("logout/");
            setIsLoggedIn(false);
        } catch (error) {
            console.error("Error during logout:", error);
        }
    };

    if (loading) return <div>Loading...</div>;

    return isLoggedIn ? (
        <div>
            <Navbar />
            <header>
                <h1>Expense Tracker</h1>
                <button onClick={logout}>Logout</button> {/* Logout Button */}
            </header>
            <Balances />
            <Expenses logout={logout} />
            <Footer />
        </div>
    ) : (
        <Login setIsLoggedIn={setIsLoggedIn} />
    );
}

export default App;
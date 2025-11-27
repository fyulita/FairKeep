import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";
import "../styles.css";

function Navbar({ logout }) { // Accept logout as a prop
    const [displayName, setDisplayName] = useState("");

    const fetchUsername = async () => {
        try {
            const response = await api.get("check-session/");
            if (response.data.authenticated) {
                setDisplayName(response.data.display_name || response.data.username);
            }
        } catch (error) {
            console.error("Error fetching username:", error);
        }
    };

    useEffect(() => {
        fetchUsername();
    }, []);

    return (
        <nav className="navbar">
            <h2 className="navbar-title">
                <Link to="/" className="navbar-title-link">Expense Tracker</Link>
            </h2>
            <div className="navbar-user-info">
                <span>{displayName}</span>
                <button className="logout-button" onClick={logout}>
                    Logout
                </button>
            </div>
        </nav>
    );
}

export default Navbar;

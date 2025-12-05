import { useState } from "react";
import api from "../api/axiosConfig";
import logo from "../assets/logo.svg";

function Login({ setIsLoggedIn, onLoginSuccess }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await api.get("csrf/");
            const response = await api.post("login/", { username, password });
            if (response.status === 200) {
                setIsLoggedIn(true);
                if (onLoginSuccess) onLoginSuccess();
            }
        } catch (error) {
            console.error("Login Failed: ", error);
            setError("Invalid username or password");
        }
    };

    return (
        <div className="main-container">
            <div className="login-hero">
                <img src={logo} alt="FairKeep logo" className="login-logo" />
                <div className="login-title">FairKeep</div>
                <p className="login-subtitle">Share expenses fairly, anywhere.</p>
            </div>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <form onSubmit={handleLogin} className="login-form">
                <div>
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        autoComplete="username"
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

export default Login;

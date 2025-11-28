import { Link, useLocation } from "react-router-dom";

const BottomNav = () => {
    const location = useLocation();
    const isActive = (path) => location.pathname === path;

    return (
        <nav className="bottom-nav">
            <Link className={`bottom-nav-item ${isActive("/") ? "active" : ""}`} to="/">
                <span className="nav-icon" aria-hidden="true">🏠</span>
                <span className="nav-label">Home</span>
            </Link>
            <Link className={`bottom-nav-item ${isActive("/activities") ? "active" : ""}`} to="/activities">
                <span className="nav-icon" aria-hidden="true">🗒️</span>
                <span className="nav-label">Activity</span>
            </Link>
            <Link className={`bottom-nav-item ${isActive("/user") ? "active" : ""}`} to="/user">
                <span className="nav-icon" aria-hidden="true">👤</span>
                <span className="nav-label">User</span>
            </Link>
        </nav>
    );
};

export default BottomNav;

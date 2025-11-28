import { useEffect, useState } from "react";
import api from "../api/axiosConfig";

const UserProfile = ({ logout }) => {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [userId, setUserId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const session = await api.get("check-session/");
                if (session.data?.authenticated) {
                    const id = session.data.id;
                    setUserId(id);
                    // Try to get full user details for first/last name
                    try {
                        const detail = await api.get(`users/${id}/`);
                        setFirstName(detail.data.first_name || "");
                        setLastName(detail.data.last_name || "");
                    } catch {
                        const display = session.data.display_name || "";
                        const [first = "", ...rest] = display.split(" ");
                        setFirstName(first);
                        setLastName(rest.join(" "));
                    }
                }
            } catch (err) {
                console.error("Error loading user", err);
            }
        };
        fetchUser();
    }, []);

    const save = async () => {
        if (!userId) return;
        setSaving(true);
        setMessage("");
        const display_name = `${firstName} ${lastName}`.trim();
        try {
            await api.patch(`users/${userId}/`, {
                first_name: firstName,
                last_name: lastName,
                display_name,
            });
            setMessage("Updated successfully.");
        } catch (err) {
            console.error("Failed to update user", err);
            setMessage("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="form-card profile-card">
            <h2>User Profile</h2>
            <p className="subtle">Update your name and keep your account info current.</p>
            <div className="profile-form">
                <div className="form-row">
                    <label>First name</label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                    />
                </div>
                <div className="form-row">
                    <label>Last name</label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                    />
                </div>
                <div className="form-actions profile-actions">
                    <button className="primary-button" onClick={save} disabled={saving || !userId}>
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
                <div className="form-actions profile-actions logout-block">
                    <button className="secondary-button" onClick={logout}>
                        Logout
                    </button>
                </div>
                {message && <p className="subtle status-message">{message}</p>}
            </div>
        </div>
    );
};

export default UserProfile;

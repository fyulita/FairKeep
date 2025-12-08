import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";

const UserProfile = ({ logout }) => {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [userId, setUserId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [pwMessage, setPwMessage] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [exporting, setExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState("");
    const [username, setUsername] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const session = await api.get("check-session/");
                if (session.data?.authenticated) {
                    const id = session.data.id;
                    setUserId(id);
                    setUsername(session.data.username || "");
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
        <div className="profile-card full-height-card page-container profile-page">
            <h2>User Profile</h2>
            <p className="subtle">Update your name and keep your account info current.</p>
            <div className="profile-form profile-section">
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
                {message && <p className="subtle status-message">{message}</p>}
            </div>

            <div className="profile-form password-block profile-section">
                <h3>Change Password</h3>
                <div className="form-row">
                    <label>Current password</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                    />
                </div>
                <div className="form-row">
                    <label>New password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min 8 chars)"
                    />
                </div>
                <div className="form-row">
                    <label>Confirm new password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                    />
                </div>
                <div className="form-actions profile-actions">
                    <button
                        className="primary-button"
                        onClick={async () => {
                            setPwMessage("");
                            if (!currentPassword || !newPassword || !confirmPassword) {
                                setPwMessage("Please fill all password fields.");
                                return;
                            }
                            if (newPassword !== confirmPassword) {
                                setPwMessage("New passwords do not match.");
                                return;
                            }
                            try {
                                setPasswordSaving(true);
                                const res = await api.post("change-password/", {
                                    current_password: currentPassword,
                                    new_password: newPassword,
                                    confirm_password: confirmPassword,
                                });
                                setPwMessage(res.data?.detail || "Password updated successfully.");
                                setCurrentPassword("");
                                setNewPassword("");
                                setConfirmPassword("");
                            } catch (err) {
                                const detail = err.response?.data?.detail || "Failed to change password.";
                                setPwMessage(detail);
                            } finally {
                                setPasswordSaving(false);
                            }
                        }}
                        disabled={passwordSaving || !userId}
                    >
                        {passwordSaving ? "Saving..." : "Change password"}
                    </button>
                </div>
                {pwMessage && <p className="subtle status-message">{pwMessage}</p>}
            </div>

            <div className="profile-form download-block profile-section">
                <h3>Export your expenses</h3>
                <div className="form-actions profile-actions">
                    <button
                        className="secondary-button"
                        onClick={async () => {
                            setExportMessage("");
                            setExporting(true);
                            try {
                                const offset = new Date().getTimezoneOffset();
                                const res = await api.get("export-expenses/", {
                                    responseType: "blob",
                                    params: { tz_offset: offset },
                                });
                                const blob = new Blob([res.data], { type: "text/csv" });
                                const stamp = new Date();
                                const pad = (n) => String(n).padStart(2, "0");
                                const ts = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}T${pad(stamp.getHours())}-${pad(stamp.getMinutes())}-${pad(stamp.getSeconds())}`;
                                let filename = `${username || "expenses"}_${ts}.csv`;
                                const disp = res.headers["content-disposition"];
                                if (disp) {
                                    const match = /filename=\"?([^\";]+)\"?/i.exec(disp);
                                    if (match) filename = match[1];
                                }
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = filename;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                window.URL.revokeObjectURL(url);
                                setExportMessage("CSV downloaded.");
                            } catch (err) {
                                console.error("Export failed", err);
                                setExportMessage("Failed to export CSV.");
                            } finally {
                                setExporting(false);
                            }
                        }}
                        disabled={exporting}
                    >
                        {exporting ? "Preparing..." : "Download expenses CSV"}
                    </button>
                </div>
                {exportMessage && <p className="subtle status-message">{exportMessage}</p>}
            </div>

            <div className="profile-form profile-section">
                <h3>Contacts</h3>
                <p className="subtle">Add people to share expenses with.</p>
                <div className="form-actions profile-actions">
                    <button className="primary-button" onClick={() => navigate("/contacts")}>
                        Add Contact
                    </button>
                </div>
            </div>

            <div className="logout-block">
                <h3>Logout</h3>
                <button className="secondary-button" onClick={logout}>
                    Logout
                </button>
            </div>
        </div>
    );
};

export default UserProfile;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";
import Contacts from "./Contacts";

const CROP_SIZE = 320;

const UserProfile = ({ logout }) => {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [userId, setUserId] = useState(null);
    const [username, setUsername] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [activeTab, setActiveTab] = useState("preferences");
    const [saving, setSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [pwMessage, setPwMessage] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [exporting, setExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState("");
    const [photoData, setPhotoData] = useState("");
    const [pendingPhotoData, setPendingPhotoData] = useState(null);
    const [photoMessage, setPhotoMessage] = useState("");
    const [photoZoom, setPhotoZoom] = useState(1);
    const [photoOffsetX, setPhotoOffsetX] = useState(0);
    const [photoOffsetY, setPhotoOffsetY] = useState(0);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImage, setCropImage] = useState("");
    const [cropZoom, setCropZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(0.3);
    const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
    const [cropDragging, setCropDragging] = useState(false);
    const [dragStart, setDragStart] = useState(null);
    const [pinchBase, setPinchBase] = useState(null);
    const [pointers, setPointers] = useState({});
    const [confirmLogout, setConfirmLogout] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const session = await api.get("check-session/");
                if (session.data?.authenticated) {
                    const id = session.data.id;
                    setUserId(id);
                    setUsername(session.data.username || "");
                    try {
                        const avatarRes = await api.get("avatar/");
                        if (avatarRes.data?.avatar) setPhotoData(avatarRes.data.avatar);
                        setPhotoZoom(1);
                        setPhotoOffsetX(0);
                        setPhotoOffsetY(0);
                    } catch {
                        /* ignore avatar fetch errors */
                    }
                    setPendingPhotoData(null);
                    let first = "";
                    let last = "";
                    try {
                        const detail = await api.get(`users/${id}/`);
                        first = detail.data.first_name || "";
                        last = detail.data.last_name || "";
                    } catch {
                        const display = session.data.display_name || "";
                        const [f = "", ...rest] = display.split(" ");
                        first = f;
                        last = rest.join(" ");
                    }
                    setFirstName(first);
                    setLastName(last);
                    setDisplayName(`${first} ${last}`.trim() || session.data.display_name || session.data.username);
                }
            } catch (err) {
                console.error("Error loading user", err);
            }
        };
        fetchUser();
    }, []);

    const savePersonalInfo = async () => {
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
            const finalPhoto = pendingPhotoData !== null ? pendingPhotoData : photoData;
            const finalConfig = { zoom: photoZoom, offsetX: photoOffsetX, offsetY: photoOffsetY };
            if (finalPhoto) {
                try {
                    await api.patch("avatar/", { avatar: finalPhoto });
                } catch (err) {
                    console.error("Failed to save avatar", err);
                }
            }
            setPhotoData(finalPhoto || "");
            setPhotoZoom(finalConfig.zoom || 1);
            setPhotoOffsetX(finalConfig.offsetX || 0);
            setPhotoOffsetY(finalConfig.offsetY || 0);
            setPendingPhotoData(null);
            setDisplayName(display_name || username);
            setMessage("Updated successfully.");
        } catch (err) {
            console.error("Failed to update user", err);
            setMessage("Failed to save changes.");
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(""), 4000);
        }
    };

    const changePassword = async () => {
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
            setTimeout(() => setPwMessage(""), 4000);
        }
    };

    const exportCsv = async () => {
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
            setTimeout(() => setExportMessage(""), 4000);
        }
    };

    const onPhotoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            setCropImage(dataUrl);
            // Fit image into crop area by default (allow further zoom-out via slider)
            const img = new Image();
            img.onload = () => {
                const fitScale = Math.min(1, Math.min(CROP_SIZE / img.width, CROP_SIZE / img.height));
                setMinZoom(fitScale || 1);
                setCropZoom(fitScale || 1);
                setCropOffset({ x: 0, y: 0 });
                setCropModalOpen(true);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    };

    const removePhoto = () => {
        setPendingPhotoData("");
        setPhotoMessage("Photo cleared. Save to apply.");
        setTimeout(() => setPhotoMessage(""), 4000);
    };

    const avatarSrcSaved = photoData || "/images/default_user.jpg";
    const avatarTransformSaved = {
        transform: `translate(${photoOffsetX}px, ${photoOffsetY}px) scale(${photoZoom})`,
    };
    const previewPhoto = pendingPhotoData !== null
        ? (pendingPhotoData === "" ? "/images/default_user.jpg" : pendingPhotoData)
        : avatarSrcSaved;
    const previewTransform = pendingPhotoData !== null ? { transform: "none" } : avatarTransformSaved;

    const onCropPointerDown = (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setPointers((prev) => ({ ...prev, [e.pointerId]: { x: e.clientX, y: e.clientY } }));
        if (Object.keys(pointers).length + 1 === 1) {
            setCropDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (Object.keys(pointers).length + 1 >= 2) {
            setPinchBase({
                distance: null,
                zoom: cropZoom,
            });
            setCropDragging(false);
            setDragStart(null);
        }
    };

    const onCropPointerMove = (e) => {
        if (!(e.pointerId in pointers)) return;
        e.preventDefault();
        setPointers((prev) => {
            const next = { ...prev, [e.pointerId]: { x: e.clientX, y: e.clientY } };
            const ids = Object.keys(next);
            if (ids.length >= 2) {
                const [aId, bId] = ids;
                const a = next[aId];
                const b = next[bId];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                setCropDragging(false);
                setDragStart(null);
                setPinchBase((base) => {
                    const initial = base?.distance || dist;
                    const scale = dist / initial;
                    const newZoom = Math.min(3, Math.max(minZoom, (base?.zoom || cropZoom) * scale));
                    setCropZoom(newZoom);
                    return { distance: initial, zoom: base?.zoom || cropZoom };
                });
            } else if (cropDragging && dragStart) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                setCropOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
                setDragStart({ x: e.clientX, y: e.clientY });
            }
            return next;
        });
    };

    const onCropPointerUp = (e) => {
        e.preventDefault();
        setPointers((prev) => {
            const next = { ...prev };
            delete next[e.pointerId];
            return next;
        });
        setCropDragging(false);
        setDragStart(null);
        setPinchBase(null);
    };

    const handleCropDone = () => {
        if (!cropImage) {
            setCropModalOpen(false);
            return;
        }
        const img = new Image();
        img.src = cropImage;
        img.onload = () => {
            const size = CROP_SIZE;
            const radius = size / 2;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);
            ctx.save();
            ctx.beginPath();
            ctx.arc(radius, radius, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();

            const scale = cropZoom;
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const centerX = radius;
            const centerY = radius;
            const dx = centerX - drawW / 2 + cropOffset.x;
            const dy = centerY - drawH / 2 + cropOffset.y;
            ctx.drawImage(img, dx, dy, drawW, drawH);
            ctx.restore();
            const dataUrl = canvas.toDataURL("image/png");
            setPendingPhotoData(dataUrl);
            setCropModalOpen(false);
            setPhotoMessage("Preview updated. Save to keep it.");
            setTimeout(() => setPhotoMessage(""), 4000);
        };
    };

    const renderTabs = () => (
        <div className="profile-tabs">
            {["preferences", "personal", "contacts"].map((tab) => (
                <button
                    key={tab}
                    className={`tab-button ${activeTab === tab ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                >
                    {tab === "preferences" && "Preferences"}
                    {tab === "personal" && "Personal Info"}
                    {tab === "contacts" && "Contacts"}
                </button>
            ))}
        </div>
    );

    const renderPreferences = () => (
        <div className="profile-section">
            <h3>Preferences</h3>
            <div className="profile-form download-block">
                <h4>Export your expenses</h4>
                <div className="form-actions profile-actions">
                    <button className="secondary-button" onClick={exportCsv} disabled={exporting}>
                        {exporting ? "Preparing..." : "Download expenses CSV"}
                    </button>
                </div>
                {exportMessage && <p className="subtle status-message">{exportMessage}</p>}
            </div>
        </div>
    );

    const renderPersonalInfo = () => (
        <div className="profile-section">
            <h3>Personal Info</h3>
            <div className="profile-form profile-section">
                <div className="avatar-block">
                    <div className="avatar-row">
                        <div className="avatar-frame">
                            <img src={previewPhoto} alt="" className="profile-avatar" style={previewTransform} />
                        </div>
                        <div className="avatar-actions">
                            <label className="secondary-button file-button">
                                Change photo
                                <input type="file" accept="image/*" onChange={onPhotoChange} />
                            </label>
                            <button className="secondary-button" type="button" onClick={removePhoto}>Remove photo</button>
                        </div>
                    </div>
                    {photoMessage && <p className="subtle status-message">{photoMessage}</p>}
                </div>
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
                    <button className="primary-button" onClick={savePersonalInfo} disabled={saving || !userId}>
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
                {message && <p className="subtle status-message">{message}</p>}
            </div>

            <div className="profile-form password-block profile-section">
                <h4>Change Password</h4>
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
                        onClick={changePassword}
                        disabled={passwordSaving || !userId}
                    >
                        {passwordSaving ? "Saving..." : "Change password"}
                    </button>
                </div>
                {pwMessage && <p className="subtle status-message">{pwMessage}</p>}
            </div>
        </div>
    );

    const renderContacts = () => (
        <div className="profile-section embedded-block">
            <h3>Contacts</h3>
            <Contacts embedded />
        </div>
    );

    return (
        <div className="profile-card full-height-card page-container profile-page">
            <div className="profile-header">
                <div className="avatar-frame large">
                    <img src={avatarSrcSaved} alt="Profile" className="profile-avatar" style={avatarTransformSaved} />
                </div>
                <div className="profile-identity">
                    <h2>{displayName || "Your name"}</h2>
                    <p className="subtle">@{username}</p>
                </div>
            </div>

            {renderTabs()}

            <div className="profile-content">
                {activeTab === "preferences" && renderPreferences()}
                {activeTab === "personal" && renderPersonalInfo()}
                {activeTab === "contacts" && renderContacts()}
            </div>

            <div className="profile-footer">
                <img src="/favicon.svg" alt="FairKeep" className="footer-logo" />
                <a href="https://github.com/fyulita/FairKeep" target="_blank" rel="noreferrer" className="primary-link">FairKeep</a>
            </div>

            <div className="profile-form profile-section logout-block">
                <button className="danger-button" onClick={() => setConfirmLogout(true)}>
                    Log Out
                </button>
            </div>

            {confirmLogout && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <h3>Log Out</h3>
                        <p className="subtle">Are you sure you want to log out?</p>
                        <div className="form-actions">
                            <button className="danger-button" onClick={logout}>Log Out</button>
                            <button className="secondary-button" onClick={() => setConfirmLogout(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {cropModalOpen && (
                <div className="modal-backdrop crop-backdrop">
                    <div className="crop-modal">
                        <h3>Adjust photo</h3>
                        <div
                            className="cropper"
                            onPointerDown={onCropPointerDown}
                            onPointerMove={onCropPointerMove}
                            onPointerUp={onCropPointerUp}
                            onPointerLeave={onCropPointerUp}
                            onWheel={(e) => {
                                e.preventDefault();
                                const delta = -e.deltaY;
                                const factor = delta > 0 ? 1.05 : 0.95;
                                const next = Math.min(3, Math.max(minZoom, cropZoom * factor));
                                setCropZoom(next);
                            }}
                        >
                            {cropImage && (
                                <img
                                    src={cropImage}
                                    alt="Crop"
                                    className="crop-image"
                                    draggable={false}
                                    style={{
                                        left: "50%",
                                        top: "50%",
                                        transform: `translate(-50%, -50%) translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                                    }}
                                />
                            )}
                            <div className="crop-mask" />
                        </div>
                        <p className="subtle small">Drag to move. Pinch with two fingers to zoom.</p>
                        <div className="form-actions">
                            <button className="secondary-button" onClick={() => setCropModalOpen(false)}>Cancel</button>
                            <button className="primary-button" onClick={handleCropDone}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserProfile;

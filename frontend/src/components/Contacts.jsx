import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";

const Contacts = () => {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const navigate = useNavigate();

    const loadContacts = async () => {
        try {
            const [c, inc, out] = await Promise.all([
                api.get("/contacts/"),
                api.get("/contacts/requests/", { params: { direction: "incoming" } }),
                api.get("/contacts/requests/", { params: { direction: "outgoing" } }),
            ]);
            setContacts(c.data || []);
            setIncoming(inc.data || []);
            setOutgoing(out.data || []);
        } catch (err) {
            console.error("Failed to load contacts", err);
        }
    };

    useEffect(() => {
        loadContacts();
    }, []);

    useEffect(() => {
        const term = search.trim();
        if (!term) {
            setResults([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        api.get("/contacts/search/", { params: { q: term } })
            .then((res) => {
                if (!cancelled) setResults(res.data || []);
            })
            .catch((err) => {
                if (!cancelled) console.error("Search failed", err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [search]);

    const sendRequest = async (id) => {
        try {
            await api.post("/contacts/requests/create/", { to_user: id });
            setMessage("Request sent.");
            setSearch("");
            setResults([]);
            loadContacts();
        } catch (err) {
            const detail = err.response?.data?.detail || "Failed to send request.";
            setMessage(detail);
        }
    };

    const acceptRequest = async (id) => {
        try {
            await api.post(`/contacts/requests/${id}/accept/`);
            loadContacts();
        } catch (err) {
            console.error("Accept failed", err);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.post("/contacts/delete/", { user_id: deleteTarget.id });
            setDeleteTarget(null);
            loadContacts();
        } catch (err) {
            console.error("Delete contact failed", err);
        }
    };

    return (
        <div className="page-container add-expense-screen">
            <h2 className="add-expense-title">Contacts</h2>
            <p className="subtle">Search by username or full name to send a contact request.</p>
            <div className="search-row">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search users"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button className="clear-button" onClick={() => setSearch("")} aria-label="Clear search">×</button>
                )}
            </div>
            {loading && <p className="subtle">Searching...</p>}
            <div className="search-results">
                {results.length === 0 && search.trim() && !loading && <p className="subtle">No matches</p>}
                {results.map((r) => (
                    <div key={r.id} className="user-result row-space">
                        <span>
                            {r.display_name || r.username}
                            <span className="subtle small">@{r.username}</span>
                        </span>
                        <button
                            className="primary-button small-button"
                            onClick={() => sendRequest(r.id)}
                            disabled={r.pending}
                        >
                            {r.pending ? "Pending" : "Add"}
                        </button>
                    </div>
                ))}
            </div>

            <div className="profile-section">
                <h3>Incoming requests</h3>
                {incoming.length === 0 && <p className="subtle">No pending requests.</p>}
                {incoming.map((req) => (
                    <div key={req.id} className="user-result row-space">
                        <span>
                            {req.from_user?.display_name || req.from_user?.username}
                            <span className="subtle small"> @{req.from_user?.username}</span>
                        </span>
                        <button className="primary-button small-button" onClick={() => acceptRequest(req.id)}>Accept</button>
                    </div>
                ))}
            </div>

            <div className="profile-section">
                <h3>Sent requests</h3>
                {outgoing.length === 0 && <p className="subtle">No sent requests.</p>}
                {outgoing.map((req) => (
                    <div key={req.id} className="user-result row-space">
                        <span>
                            {req.to_user?.display_name || req.to_user?.username}
                            <span className="subtle small"> @{req.to_user?.username}</span>
                        </span>
                        <span className="subtle">{req.status}</span>
                    </div>
                ))}
            </div>

            <div className="profile-section">
                <h3>Your contacts</h3>
                {contacts.length === 0 && <p className="subtle">No contacts yet.</p>}
                <div className="user-list-items">
                    {contacts.map((c) => (
                        <div key={c.id} className="user-result row-space full-width-item">
                            <div>
                                <div>{c.display_name || c.username}</div>
                                <div className="subtle small">@{c.username}</div>
                            </div>
                            <button className="secondary-button small-button" onClick={() => setDeleteTarget(c)}>
                                Delete Contact
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {message && <p className="subtle status-message">{message}</p>}

            <div className="form-actions">
                <button className="secondary-button" onClick={() => navigate(-1)}>Back</button>
            </div>

            {deleteTarget && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <h3>Delete Contact</h3>
                        <p className="subtle">Are you sure you want to delete {deleteTarget.display_name || deleteTarget.username} as a contact?</p>
                        <div className="form-actions">
                            <button className="danger-button" onClick={confirmDelete}>Delete</button>
                            <button className="secondary-button" onClick={() => setDeleteTarget(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Contacts;

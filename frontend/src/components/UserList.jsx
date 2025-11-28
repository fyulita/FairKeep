import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";

function UserList({ currentUserId, refreshKey }) {
    const [users, setUsers] = useState([]);
    const [sharedIds, setSharedIds] = useState(new Set());
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(true);
    const [confirmUserId, setConfirmUserId] = useState(null);
    const userName = (id) => {
        const u = users.find((x) => x.id === Number(id));
        return u ? u.display_name || u.username : `User #${id}`;
    };

    const fetchData = async () => {
        try {
            const [usersRes, expensesRes, balancesRes] = await Promise.all([
                api.get("users/"),
                api.get("expenses/"),
                api.get("balances/"),
            ]);
            setUsers(usersRes.data);
            const balanceMap = {};
            (balancesRes.data || []).forEach((b) => {
                balanceMap[b.user_id] = b.amount;
            });
            setBalances(balanceMap);

            if (currentUserId) {
                const me = Number(currentUserId);
                const shared = new Set();
                expensesRes.data.forEach((expense) => {
                    const ids = new Set();
                    if (expense.participants) {
                        expense.participants.forEach((p) => ids.add(Number(p)));
                    }
                    if (expense.splits) {
                        expense.splits.forEach((s) => ids.add(Number(s.user)));
                    }
                    if (expense.paid_by) {
                        ids.add(Number(expense.paid_by));
                    }
                    if (ids.has(me)) {
                        ids.forEach((id) => {
                            if (id !== me) shared.add(id);
                        });
                    }
                });
                setSharedIds(shared);
            }
        } catch (error) {
            console.error("Error fetching users or expenses:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUserId, refreshKey]);

    const sharedUsers = useMemo(
        () => users.filter((u) => sharedIds.has(u.id)),
        [users, sharedIds]
    );

    const settleUp = async (userId) => {
        const amount = Math.abs(balances[userId] || 0);
        if (amount === 0) return;
        setConfirmUserId(userId);
    };

    const confirmSettle = async () => {
        if (!confirmUserId) return;
        try {
            await api.post("settle/", { user_id: confirmUserId });
            await fetchData();
        } catch (error) {
            console.error("Error settling up:", error);
        }
        setConfirmUserId(null);
    };

    if (loading) return <p>Loading users...</p>;

    const nonZeroUsers = sharedUsers.filter((u) => (balances[u.id] || 0) !== 0);
    const zeroUsers = sharedUsers.filter((u) => (balances[u.id] || 0) === 0);

    return (
        <div className="user-list">
            {confirmUserId && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <h3>Settle Up</h3>
                        <p>
                            {userName(confirmUserId)} pays ${Math.abs(balances[confirmUserId] || 0).toFixed(2)} to you
                        </p>
                        <div className="form-actions">
                            <button className="primary-button" onClick={confirmSettle}>Yes</button>
                            <button className="secondary-button" onClick={() => setConfirmUserId(null)}>No</button>
                        </div>
                    </div>
                </div>
            )}
            {sharedUsers.length === 0 ? (
                <p>No shared expenses yet.</p>
            ) : (
                <>
                    <div className="user-list-items">
                        {nonZeroUsers.map((user) => (
                            <div key={user.id} className="user-pill">
                                <Link to={`/with/${user.id}`} className="user-pill-link">
                                    <span className="user-pill-name">{user.display_name || user.username}</span>
                                    <span
                                        className={`user-pill-balance ${
                                            (balances[user.id] || 0) >= 0 ? "balance-positive" : "balance-negative"
                                        }`}
                                    >
                                        {(balances[user.id] || 0) >= 0 ? "+" : "-"}${Math.abs(balances[user.id] || 0)}
                                    </span>
                                </Link>
                                <button
                                    className="secondary-button"
                                    onClick={() => settleUp(user.id)}
                                >
                                    Settle Up
                                </button>
                            </div>
                        ))}
                    </div>
                    {zeroUsers.length > 0 && (
                        <details className="settled-users">
                            <summary>Settled balances</summary>
                            <div className="user-list-items">
                                {zeroUsers.map((user) => (
                                    <div key={user.id} className="user-pill">
                                        <Link to={`/with/${user.id}`} className="user-pill-link">
                                            <span className="user-pill-name">{user.display_name || user.username}</span>
                                            <span className="user-pill-balance balance-positive">+0</span>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}

export default UserList;

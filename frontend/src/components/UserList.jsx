import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";

function UserList({ currentUserId, refreshKey }) {
    const [users, setUsers] = useState([]);
    const [sharedIds, setSharedIds] = useState(new Set());
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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

        fetchData();
    }, [currentUserId, refreshKey]);

    const sharedUsers = useMemo(
        () => users.filter((u) => sharedIds.has(u.id)),
        [users, sharedIds]
    );

    if (loading) return <p>Loading users...</p>;

    return (
        <div className="user-list">
            {sharedUsers.length === 0 ? (
                <p>No shared expenses yet.</p>
            ) : (
                <div className="user-list-items">
                    {sharedUsers.map((user) => (
                        <Link key={user.id} to={`/with/${user.id}`} className="user-pill">
                            <span className="user-pill-name">{user.display_name || user.username}</span>
                            <span
                                className={`user-pill-balance ${
                                    (balances[user.id] || 0) >= 0 ? "balance-positive" : "balance-negative"
                                }`}
                            >
                                {(balances[user.id] || 0) >= 0 ? "+" : "-"}${Math.abs(balances[user.id] || 0)}
                            </span>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

export default UserList;

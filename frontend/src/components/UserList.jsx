import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";

function UserList({ currentUserId, refreshKey }) {
    const [users, setUsers] = useState([]);
    const [sharedIds, setSharedIds] = useState(new Set());
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(true);
    const [confirmUserId, setConfirmUserId] = useState(null);
    const [confirmCurrency, setConfirmCurrency] = useState(null);
    const [selectUserId, setSelectUserId] = useState(null);
    const userName = (id) => {
        const u = users.find((x) => x.id === Number(id));
        return u ? u.display_name || u.username : `User #${id}`;
    };
    const currencySymbol = (code) => {
        const map = {
            ARS: "$",
            UYU: "$",
            CLP: "$",
            MXN: "$",
            BRL: "R$",
            USD: "$",
            EUR: "€",
            GBP: "£",
            JPY: "¥",
            PYG: "₲",
            AUD: "A$",
            KRW: "₩",
        };
        return map[code] || code;
    };
    const currencyLabel = (code) => `${code}${currencySymbol(code)}`;

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
                const arr = balanceMap[b.user_id] || [];
                arr.push({ currency: b.currency, amount: b.amount });
                balanceMap[b.user_id] = arr;
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

    const settleUp = (userId) => {
        const entries = balances[userId] || [];
        const nonZero = entries.filter((b) => (b.amount || 0) !== 0);
        if (nonZero.length === 0) return;
        if (nonZero.length === 1) {
            setConfirmUserId(userId);
            setConfirmCurrency(nonZero[0].currency);
            setSelectUserId(null);
        } else {
            setSelectUserId(userId);
        }
    };

    const chooseCurrency = (userId, currency) => {
        const amount = Math.abs((balances[userId]?.find((b) => b.currency === currency)?.amount) || 0);
        if (amount === 0) return;
        setConfirmUserId(userId);
        setConfirmCurrency(currency);
        setSelectUserId(null);
    };

    const confirmSettle = async () => {
        if (!confirmUserId || !confirmCurrency) return;
        try {
            await api.post("settle/", { user_id: confirmUserId, currency: confirmCurrency });
            await fetchData();
        } catch (error) {
            console.error("Error settling up:", error);
        }
        setConfirmUserId(null);
        setConfirmCurrency(null);
    };

    if (loading) return <p>Loading users...</p>;

    const nonZeroUsers = sharedUsers.filter((u) => {
        const items = balances[u.id] || [];
        return items.some((b) => (b.amount || 0) !== 0);
    });
    const zeroUsers = sharedUsers.filter((u) => {
        const items = balances[u.id] || [];
        return items.every((b) => (b.amount || 0) === 0);
    });

    return (
        <div className="user-list page-container">
            {selectUserId && (
                <div className="modal-backdrop">
                            <div className="modal-card">
                                <h3>Settle up with {userName(selectUserId)}</h3>
                                <p>Select which balance to settle:</p>
                                <div className="currency-options">
                                    {(balances[selectUserId] || []).map((b, idx) => (
                                        (b.amount || 0) !== 0 && (
                                            <button
                                                key={idx}
                                                className="currency-pill"
                                                onClick={() => chooseCurrency(selectUserId, b.currency)}
                                            >
                                                {(b.amount || 0) >= 0 ? "They owe you" : "You owe"} {`${currencyLabel(b.currency)}${Math.abs(b.amount || 0).toFixed(2)}`}
                                            </button>
                                        )
                                    ))}
                        </div>
                        <div className="form-actions">
                            <button className="secondary-button" onClick={() => setSelectUserId(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {confirmUserId && confirmCurrency && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <h3>Settle Up</h3>
                        <p>
                            {userName(confirmUserId)} pays {`${confirmCurrency}${Math.abs(balances[confirmUserId]?.find((b) => b.currency === confirmCurrency)?.amount || 0).toFixed(2)}`} to you
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
                    {nonZeroUsers.map((user) => {
                        const userBalances = balances[user.id] || [];
                        return (
                            <Link key={user.id} to={`/with/${user.id}`} className="user-pill user-pill-column user-pill-link">
                                <div className="user-pill-header">
                                        <span className="user-pill-name">{user.display_name || user.username}</span>
                                        <button
                                            className="secondary-button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                settleUp(user.id);
                                            }}
                                        >
                                            Settle
                                        </button>
                                    </div>
                                    <div className="user-balance-lines">
                                        {userBalances.map((b, idx) => (
                                            (b.amount || 0) !== 0 && (
                                                <div
                                                    key={idx}
                                                    className={(b.amount || 0) >= 0 ? "balance-line positive" : "balance-line negative"}
                                                >
                                                    {(b.amount || 0) >= 0 ? "Owes you" : "You owe"} {`${currencyLabel(b.currency)}${Math.abs(b.amount || 0).toFixed(2)}`}
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                    {zeroUsers.length > 0 && (
                        <details className="settled-users">
                            <summary>Settled balances</summary>
                            <div className="user-list-items">
                                {zeroUsers.map((user) => (
                                    <Link key={user.id} to={`/with/${user.id}`} className="user-pill user-pill-link">
                                        <span className="user-pill-name">{user.display_name || user.username}</span>
                                        <span className="user-pill-balance balance-positive">+0</span>
                                    </Link>
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

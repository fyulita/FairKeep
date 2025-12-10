import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

function MySpending({ currentUserId }) {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [res, usersRes] = await Promise.all([
                    api.get("expenses/"),
                    api.get("users/"),
                ]);
                setExpenses(res.data || []);
                setUsers(usersRes.data || []);
            } catch (err) {
                console.error("Failed to load expenses", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const today = new Date();
    const currentKey = monthKey(today);

    const stats = useMemo(() => {
        let gross = 0;
        let net = 0;
        let personalGross = 0;
        let sharedGross = 0;
        let personalCount = 0;
        let sharedCount = 0;
        const personalList = [];
        const sharedMap = new Map();

        expenses.forEach((exp) => {
            if (!exp.participants || !exp.expense_date) return;
            const [y, m, d] = exp.expense_date.split("-");
            const key = `${y}-${m}`;
            if (key !== currentKey) return;

            const splits = exp.splits || [];
            const userSplit = splits.find((s) => Number(s.user) === Number(currentUserId));
            const owed = parseFloat(userSplit?.owed_amount || 0);
            const paid = parseFloat(userSplit?.paid_amount || 0);
            const amount = parseFloat(exp.amount || 0);
            const isPersonal = exp.split_method === "personal" || (exp.participants || []).length === 1 || splits.length === 1;

            if (isPersonal) {
                personalGross += owed || amount;
                personalCount += 1;
                personalList.push(exp);
            } else {
                sharedGross += owed;
                sharedCount += 1;
                // Accumulate by contact
                splits.forEach((s) => {
                    const uid = Number(s.user);
                    if (uid === Number(currentUserId)) return;
                    const existing = sharedMap.get(uid) || { amount: 0, count: 0 };
                    existing.amount += parseFloat(s.owed_amount || 0);
                    existing.count += 1;
                    sharedMap.set(uid, existing);
                });
            }

            gross += owed || amount;
            net += paid - owed;
        });

        // Sort personal by date desc
        personalList.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

        return {
            gross,
            net,
            personalGross,
            sharedGross,
            personalCount,
            sharedCount,
            personalList,
            sharedMap,
        };
    }, [expenses, currentKey, currentUserId]);

    const currencyLabel = (code) => {
        const map = { ARS: "$", UYU: "$", CLP: "$", MXN: "$", BRL: "R$", USD: "$", EUR: "€", GBP: "£", JPY: "¥", PYG: "₲", AUD: "A$", KRW: "₩" };
        return map[code] || code;
    };

    const formatMoney = (code, amt) => `${currencyLabel(code)}${(amt || 0).toFixed(2)}`;

    const currentCurrency = "ARS"; // display currency; expenses may mix; keeping a single label for summary

    const sharedList = useMemo(() => {
        const entries = [];
        stats.sharedMap.forEach((val, uid) => {
            const u = users.find((x) => x.id === uid);
            entries.push({
                id: uid,
                name: u?.display_name || u?.username || `User #${uid}`,
                amount: val.amount,
                count: val.count,
            });
        });
        return entries.sort((a, b) => b.amount - a.amount);
    }, [stats.sharedMap, users]);

    if (loading) return <div className="page-container"><p>Loading...</p></div>;

    return (
        <div className="page-container spending-container">
            <h2 className="page-title">My Spending</h2>
            <p className="subtle center-text">Current month overview</p>

            <div className="summary-cards">
                <div className="summary-card">
                    <p className="label">Gross (your share)</p>
                    <p className="value">{formatMoney(currentCurrency, stats.gross)}</p>
                </div>
                <div className="summary-card">
                    <p className="label">Net after settle</p>
                    <p className="value">{formatMoney(currentCurrency, stats.net)}</p>
                    <p className="hint">(paid - owed)</p>
                </div>
            </div>

            <div className="summary-cards two-cols">
                <Link to="/personal-expenses" className="summary-card link-card">
                    <p className="label">Personal spend</p>
                    <p className="value">{formatMoney(currentCurrency, stats.personalGross)}</p>
                    <p className="hint">{stats.personalCount} personal expenses</p>
                </Link>
                <Link to="/shared-expenses" className="summary-card link-card">
                    <p className="label">Shared spend</p>
                    <p className="value">{formatMoney(currentCurrency, stats.sharedGross)}</p>
                    <p className="hint">{stats.sharedCount} shared expenses</p>
                </Link>
            </div>

            <div className="profile-section">
                <h3>Shared by contact</h3>
                {sharedList.length === 0 ? (
                    <p className="subtle">No shared expenses with contacts this month.</p>
                ) : (
                    <div className="spending-shared-list">
                        {sharedList.map((item) => (
                            <Link key={item.id} to={`/with/${item.id}`} className="spending-link">
                                <div className="spending-link-main">
                                    <div>
                                        <div className="label strong">{item.name}</div>
                                        <div className="hint">{item.count} shared items</div>
                                    </div>
                                    <div className="value">{formatMoney(currentCurrency, item.amount)}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MySpending;

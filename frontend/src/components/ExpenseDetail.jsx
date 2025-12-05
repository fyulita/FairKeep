import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axiosConfig";

function ExpenseDetail({ currentUserId }) {
    const { expenseId } = useParams();
    const navigate = useNavigate();
    const [expense, setExpense] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);
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
        return map[code] || "";
    };
    const formatCurrency = (code, amt) => {
        const num = parseFloat(amt);
        const display = Number.isFinite(num) ? num.toFixed(2) : amt;
        return `${code}${currencySymbol(code)}${display}`;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [expRes, usersRes] = await Promise.all([
                    api.get(`expenses/${expenseId}/`),
                    api.get("users/"),
                ]);
                setExpense(expRes.data);
                setUsers(usersRes.data);
            } catch (err) {
                console.error("Error loading expense", err);
                setError("Failed to load expense");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [expenseId]);

    const userName = (id) => {
        const u = users.find((x) => x.id === Number(id));
        return u ? u.display_name || u.username : `User #${id}`;
    };

    const splitRows = useMemo(() => {
        if (!expense || !expense.splits) return [];
        return expense.splits.map((s, idx) => {
            const paid = parseFloat(s.paid_amount || 0);
            const owed = parseFloat(s.owed_amount || 0);
            const net = paid - owed; // positive: paid more than owed
            return {
                key: `${s.user}-${idx}`,
                user: userName(s.user),
                paid,
                owed,
                net,
            };
        });
    }, [expense, users]);

    const splitMethodLabel = expense?.split_method
        ? expense.split_method.charAt(0).toUpperCase() + expense.split_method.slice(1)
        : "";

    const [confirmingDelete, setConfirmingDelete] = useState(false);

    if (loading) return <p>Loading expense...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (!expense) return null;

    const formatDate = (iso) => {
        if (!iso) return "";
        const [y, m, d] = iso.split("-");
        return `${d}/${m}/${y}`;
    };

    const formatDateTime = (isoString) => {
        if (!isoString) return "";
        const date = new Date(isoString);
        const pad = (n) => String(n).padStart(2, "0");
        const d = pad(date.getDate());
        const m = pad(date.getMonth() + 1);
        const y = date.getFullYear();
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    };

    const prettyDate = expense.expense_date
        ? formatDate(expense.expense_date)
        : formatDateTime(expense.date);

    return (
        <div className="expense-detail page-container">
            <div className="page-actions" style={{ justifyContent: "center", gap: "12px" }}>
                <button className="secondary-button" onClick={() => navigate(-1)}>Back</button>
                <Link className="primary-button" to={`/expenses/${expense.id}/edit`}>Edit</Link>
                <button
                    className="danger-button"
                    disabled={deleting}
                    onClick={() => setConfirmingDelete(true)}
                >
                    {deleting ? "Deleting..." : "Delete"}
                </button>
            </div>
            {confirmingDelete && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <h3>Delete Expense</h3>
                        <p>Are you sure you want to delete “{expense.name}”?</p>
                        <div className="form-actions">
                            <button
                                className="danger-button"
                                disabled={deleting}
                                onClick={async () => {
                                    try {
                                        setDeleting(true);
                                        await api.delete(`/expenses/${expense.id}/`);
                                        navigate("/");
                                    } catch (err) {
                                        console.error("Error deleting expense", err);
                                        setDeleting(false);
                                        setError("Failed to delete expense");
                                    } finally {
                                        setConfirmingDelete(false);
                                    }
                                }}
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                            <button className="secondary-button" onClick={() => setConfirmingDelete(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <h2>{expense.name}</h2>
            <div className="expense-detail-meta">
                <div><strong>Amount:</strong> {formatCurrency(expense.currency, expense.amount)}</div>
                <div><strong>Category:</strong> {expense.category}</div>
                <div><strong>Expense Date:</strong> {prettyDate}</div>
                <div><strong>Recorded At:</strong> {formatDateTime(expense.date)}</div>
                <div><strong>Paid By:</strong> {expense.paid_by_display || expense.paid_by_username || `User #${expense.paid_by}`}</div>
                <div><strong>Added By:</strong> {expense.added_by_display || expense.added_by}</div>
                <div><strong>Split Method:</strong> {splitMethodLabel}</div>
                <div><strong>Currency:</strong> {formatCurrency(expense.currency, "")}</div>
            </div>
            <h3>Participants</h3>
            <div className="split-table-wrapper">
                <table className="split-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Paid</th>
                            <th>Owed</th>
                            <th>Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        {splitRows.map((row) => (
                            <tr key={row.key}>
                                <td>{row.user}</td>
                                <td>${row.paid.toFixed(2)}</td>
                                <td>${row.owed.toFixed(2)}</td>
                                <td className={row.net >= 0 ? "balance-positive" : "balance-negative"}>
                                    {row.net >= 0 ? "+" : "-"}${Math.abs(row.net).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ExpenseDetail;

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

    if (loading) return <p>Loading expense...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (!expense) return null;

    const dateParts = expense.expense_date ? expense.expense_date.split("-") : null;
    const prettyDate = dateParts
        ? `${new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2])).toLocaleDateString()}`
        : new Date(expense.date).toLocaleDateString();

    return (
        <div className="expense-detail">
            <div className="page-actions">
                <button className="secondary-button" onClick={() => navigate(-1)}>Back</button>
                <Link className="primary-button" to={`/expenses/${expense.id}/edit`}>Edit</Link>
                <button
                    className="danger-button"
                    disabled={deleting}
                    onClick={async () => {
                        const ok = window.confirm("Delete this expense?");
                        if (!ok) return;
                        try {
                            setDeleting(true);
                            await api.delete(`/expenses/${expense.id}/`);
                            navigate("/");
                        } catch (err) {
                            console.error("Error deleting expense", err);
                            setDeleting(false);
                            setError("Failed to delete expense");
                        }
                    }}
                >
                    {deleting ? "Deleting..." : "Delete Expense"}
                </button>
                <Link className="secondary-button" to="/add-expense">Add Expense</Link>
            </div>
            <h2>{expense.name}</h2>
            <div className="expense-detail-meta">
                <div><strong>Amount:</strong> ${expense.amount}</div>
                <div><strong>Category:</strong> {expense.category}</div>
                <div><strong>Expense Date:</strong> {prettyDate}</div>
                <div><strong>Recorded At:</strong> {new Date(expense.date).toLocaleString()}</div>
                <div><strong>Paid By:</strong> {expense.paid_by_display || expense.paid_by_username || `User #${expense.paid_by}`}</div>
                <div><strong>Added By:</strong> {expense.added_by_display || expense.added_by}</div>
                <div><strong>Split Method:</strong> {splitMethodLabel}</div>
            </div>
            <h3>Participants</h3>
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
    );
}

export default ExpenseDetail;

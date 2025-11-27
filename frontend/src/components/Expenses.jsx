import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";

function Expenses({ refreshKey, filterUserId, currentUserId, onlyCurrentUser = false, title = "Expenses", showBack = false }) {
    const [expenses, setExpenses] = useState([]);

    const fetchExpenses = async () => {
        try {
            const response = await api.get("expenses/");
            setExpenses(response.data);
        } catch (error) {
            console.error("Error fetching expenses:", error);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, [refreshKey]);

    const filteredExpenses = useMemo(() => {
        const targetId = filterUserId ? Number(filterUserId) : null;
        const me = currentUserId ? Number(currentUserId) : null;

        return [...expenses]
            .filter((expense) => {
                const participants = expense.participants || [];

                if (onlyCurrentUser && me !== null) {
                    return participants.includes(me);
                }

                if (targetId !== null) {
                    if (me !== null) {
                        return participants.includes(targetId) && participants.includes(me);
                    }
                    return participants.includes(targetId);
                }

                return true;
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [expenses, filterUserId, currentUserId, onlyCurrentUser]);

    return (
        <div>
            {showBack && (
                <div className="page-actions">
                    <Link className="secondary-button" to="/">Back</Link>
                </div>
            )}
            <h2>{title}</h2>
            <div className="expense-list">
                {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense) => {
                        const dateObj = expense.expense_date
                            ? new Date(expense.expense_date)
                            : new Date(expense.date);
                        const month = dateObj.toLocaleString("en-US", { month: "short" });
                        const day = dateObj.getDate();
                        const paidByYou = currentUserId && Number(expense.paid_by) === Number(currentUserId);
                        const payerLabel =
                            expense.paid_by_display ||
                            expense.paid_by_username ||
                            (expense.paid_by ? `User #${expense.paid_by}` : "Unknown");

                        let counterpartyStatus = null;
                        let counterpartyAmount = null;
                        if (filterUserId && expense.splits) {
                            const me = currentUserId ? Number(currentUserId) : null;
                            const other = Number(filterUserId);
                            const payer = Number(expense.paid_by);

                            const sumOwedForUser = (userId) =>
                                expense.splits
                                    .filter((s) => Number(s.user) === userId)
                                    .reduce((acc, s) => acc + parseFloat(s.owed_amount || 0), 0);

                            const myOwed = me ? sumOwedForUser(me) : null;
                            const otherOwed = sumOwedForUser(other);

                            if (me && payer === me && otherOwed !== null) {
                                counterpartyStatus = "lent";
                                counterpartyAmount = otherOwed;
                            } else if (me && payer === other && myOwed !== null) {
                                counterpartyStatus = "borrowed";
                                counterpartyAmount = myOwed;
                            }
                        }

                        return (
                            <div key={expense.id} className="expense-row">
                                <div className="expense-date">
                                    <div className="expense-month">{month}</div>
                                    <div className="expense-day">{day}</div>
                                </div>
                                <div className="expense-main">
                                    <div className="expense-title">{expense.name}</div>
                                    <div className="expense-sub">
                                        {paidByYou
                                            ? `You paid $${expense.amount}`
                                            : `${payerLabel} paid $${expense.amount}`}
                                    </div>
                                </div>
                                <div className="expense-amount">
                                    {counterpartyStatus ? (
                                        <>
                                            {counterpartyStatus === "lent" && (
                                                <div className="status-text lent">you lent</div>
                                            )}
                                            {counterpartyStatus === "borrowed" && (
                                                <div className="status-text borrowed">you borrowed</div>
                                            )}
                                            <div className="status-amount">
                                                {counterpartyAmount !== null ? `$${counterpartyAmount.toFixed(2)}` : ""}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="status-amount" />
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p>No expenses to show</p>
                )}
            </div>
        </div>
    );
}

export default Expenses;

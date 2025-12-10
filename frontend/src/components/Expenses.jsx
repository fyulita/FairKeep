import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosConfig";

function Expenses({ refreshKey, filterUserId, currentUserId, onlyCurrentUser = false, personalOnly = false, sharedOnly = false, title = "Expenses" }) {
    const [expenses, setExpenses] = useState([]);
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

        const getDisplayDate = (expense) => {
            if (expense.expense_date) {
                // expense_date is YYYY-MM-DD
                const [y, m, d] = expense.expense_date.split("-");
                return new Date(Number(y), Number(m) - 1, Number(d));
            }
            return new Date(expense.date);
        };

        return [...expenses]
            .filter((expense) => {
                const participants = expense.participants || [];
                const isPersonal = expense.split_method === "personal" || participants.length === 1;

                if (personalOnly) {
                    return isPersonal && (me === null || participants.includes(me));
                }

                if (sharedOnly) {
                    const involvesMe = me === null || participants.includes(me);
                    return !isPersonal && involvesMe;
                }

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
            .sort((a, b) => getDisplayDate(b) - getDisplayDate(a));
    }, [expenses, filterUserId, currentUserId, onlyCurrentUser, personalOnly, sharedOnly]);

    return (
        <div className="page-container">
            <h2 className="page-title">{title}</h2>
            <div className="expense-list">
                {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense) => {
                        let month = "";
                        let day = "";
                        let fullDate = "";
                        if (expense.expense_date) {
                            const [y, m, d] = expense.expense_date.split("-");
                            const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
                            month = dateObj.toLocaleString("en-US", { month: "short" });
                            day = Number(d);
                            const pad = (n) => String(n).padStart(2, "0");
                            fullDate = `${pad(d)}/${pad(m)}/${y}`;
                        } else {
                            const dateObj = new Date(expense.date);
                            month = dateObj.toLocaleString("en-US", { month: "short" });
                            day = dateObj.getDate();
                            const pad = (n) => String(n).padStart(2, "0");
                            fullDate = `${pad(dateObj.getDate())}/${pad(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`;
                        }
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
                            <Link key={expense.id} to={`/expenses/${expense.id}`} className="expense-row">
                                <div className="expense-date">
                                    <div className="expense-month">{month}</div>
                                    <div className="expense-day">{day}</div>
                                </div>
                                <div className="expense-main">
                                    <div className="expense-title">{expense.name}</div>
                                    <div className="expense-sub">
                                        {paidByYou
                                            ? `You paid ${formatCurrency(expense.currency, expense.amount)}`
                                            : `${payerLabel} paid ${formatCurrency(expense.currency, expense.amount)}`
                                        }
                                    </div>
                                </div>
                                <div className="expense-amount">
                                    {counterpartyStatus ? (
                                        <>
                                            {counterpartyStatus === "lent" && (
                                                <div className="status-text lent keep-color">you lent</div>
                                            )}
                                            {counterpartyStatus === "borrowed" && (
                                                <div className="status-text borrowed keep-color">you borrowed</div>
                                            )}
                                            <div className="status-amount">
                                                {counterpartyAmount !== null ? formatCurrency(expense.currency, counterpartyAmount) : ""}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="status-amount" />
                                    )}
                                </div>
                            </Link>
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

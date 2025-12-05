import { useEffect, useState } from "react";
import api from "../api/axiosConfig";

function Activities() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
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
    const currencyLabel = (code) => `${code}${currencySymbol(code)}`;
    const formatAmount = (code, amount) => {
        const num = parseFloat(amount);
        const display = Number.isFinite(num) ? num.toFixed(2) : amount;
        return `${code}${currencySymbol(code)}${display}`;
    };

    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const res = await api.get("activities/");
                setActivities(res.data || []);
            } catch (err) {
                console.error("Error fetching activities", err);
                setError("Failed to load activities");
            } finally {
                setLoading(false);
            }
        };
        fetchActivities();
    }, []);

    const formatDateTime = (iso) => {
        if (!iso) return "";
        const date = new Date(iso);
        const pad = (n) => String(n).padStart(2, "0");
        const d = pad(date.getDate());
        const m = pad(date.getMonth() + 1);
        const y = date.getFullYear();
        const hh = pad(date.getHours());
        const mm = pad(date.getMinutes());
        const ss = pad(date.getSeconds());
        return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    };

    const pretty = (text = "") => text.charAt(0).toUpperCase() + text.slice(1);

    if (loading) return <p className="page-container">Loading activities...</p>;
    if (error) return <p className="error-message page-container">{error}</p>;

    return (
        <div className="activities page-container">
            <h2 className="page-title">Activity</h2>
            {activities.length === 0 ? (
                <p>No activity yet.</p>
            ) : (
                <ul className="activity-list">
                    {activities.map((act) => (
                        <li key={act.id} className="activity-item">
                            {act.action !== "deleted" && act.expense ? (
                                <a className="activity-link" href={`/expenses/${act.expense}`}>
                                    <div>
                                        <div className="activity-title">{act.expense_name}</div>
                                        <div className="activity-meta">
                                            {pretty(act.action)} • {formatDateTime(act.created_at)} • {pretty(act.split_method)} • {currencyLabel(act.currency)}
                                        </div>
                                    </div>
                                    <div className="activity-amount keep-color">{formatAmount(act.currency, act.expense_amount)}</div>
                                </a>
                            ) : (
                                <div className="activity-link disabled">
                                    <div>
                                        <div className="activity-title">{act.expense_name}</div>
                                        <div className="activity-meta">
                                            {pretty(act.action)} • {formatDateTime(act.created_at)} • {pretty(act.split_method)} • {currencyLabel(act.currency)}
                                        </div>
                                    </div>
                                    <div className="activity-amount keep-color">{formatAmount(act.currency, act.expense_amount)}</div>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default Activities;

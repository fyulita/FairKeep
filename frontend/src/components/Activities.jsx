import { useEffect, useState } from "react";
import api from "../api/axiosConfig";

function Activities() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    if (loading) return <p>Loading activities...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="activities">
            <div className="page-actions">
                <button className="secondary-button" onClick={() => window.history.back()}>Back</button>
            </div>
            <h2>Activity</h2>
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
                                            {act.action} • {new Date(act.created_at).toLocaleString()} • {act.split_method} • {act.currency}
                                        </div>
                                    </div>
                                    <div className="activity-amount">{act.currency} {act.expense_amount}</div>
                                </a>
                            ) : (
                                <div className="activity-link disabled">
                                    <div>
                                        <div className="activity-title">{act.expense_name}</div>
                                        <div className="activity-meta">
                                            {act.action} • {new Date(act.created_at).toLocaleString()} • {act.split_method} • {act.currency}
                                        </div>
                                    </div>
                                    <div className="activity-amount">{act.currency} {act.expense_amount}</div>
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

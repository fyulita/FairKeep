import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import AddExpenseForm from "./AddExpenseForm";
import api from "../api/axiosConfig";

function EditExpense({ onDone }) {
    const { expenseId } = useParams();
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchExpense = async () => {
            try {
                const res = await api.get(`expenses/${expenseId}/`);
                setInitialData(res.data);
            } catch (err) {
                console.error("Error fetching expense", err);
                setError("Failed to load expense");
            } finally {
                setLoading(false);
            }
        };
        fetchExpense();
    }, [expenseId]);

    if (loading) return <p>Loading expense...</p>;
    if (error) return <p className="error-message">{error}</p>;
    if (!initialData) return null;

    return (
        <AddExpenseForm
            expenseId={expenseId}
            initialData={initialData}
            onSuccess={onDone}
            onCancel={onDone}
        />
    );
}

export default EditExpense;

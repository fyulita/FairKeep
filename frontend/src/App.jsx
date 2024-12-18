import { useEffect, useState } from "react";
import api from "./api/axiosConfig";

function App() {
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        const fetchExpenses = async () => {
            try {
                const response = await api.get("/expenses/");
                setExpenses(response.data);
            } catch (error) {
                console.error("Error fetching expenses:", error);
            }
        };

        fetchExpenses();
    }, []);

    return (
        <div>
            <h1>Expenses</h1>
            <ul>
                {expenses.map((expense) => (
                    <li key={expense.id}>
                        {expense.name}: ${expense.amount}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default App;
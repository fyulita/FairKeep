import { useState, useEffect } from "react";
import api from "../api/axiosConfig";
import AddExpenseForm from "./AddExpenseForm";

function Expenses({ logout }) {
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
    }, []);

    return (
        <div>
            <h2>Expenses</h2>
            <ul>
                {expenses.length > 0 ? (
                    expenses.map((expense, index) => (
                        <li key={index}>
                            {expense.name}: ${expense.amount}
                        </li>
                    ))
                ) : (
                    <p>No expenses to show</p>
                )}
            </ul>
            <h2>Add New Expense</h2>
            <AddExpenseForm onAddExpense={fetchExpenses} />
        </div>
    );
}

export default Expenses;
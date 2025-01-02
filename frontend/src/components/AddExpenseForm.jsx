import { useState, useEffect } from "react";
import api from "../api/axiosConfig";

function AddExpenseForm({ onAddExpense }) {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [amount, setAmount] = useState("");
    const [paidBy, setPaidBy] = useState("");
    const [users, setUsers] = useState([]); // Fetch users locally

    // Fetch users on component mount
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get("users/");
                if (Array.isArray(response.data)) {
                    setUsers(response.data);
                } else {
                    console.error("Invalid users data:", response.data);
                }
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };
        fetchUsers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
    
        // Prepare a basic splits array (e.g., split equally among participants for now)
        const splits = [
            { user: paidBy, paid_amount: parseFloat(amount), owed_amount: parseFloat(amount) },
        ];
    
        const payload = {
            name,
            category,
            amount: parseFloat(amount),
            paid_by: paidBy, // Use the correct state variable
            splits,
        };
    
        try {
            await api.post("expenses/", payload);
            onAddExpense();
            setName("");
            setCategory("");
            setAmount("");
            setPaidBy("");
        } catch (error) {
            console.error("Error adding expense:", error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="expense-form">
            <div>
                <label htmlFor="name">Name:</label>
                <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="category">Category:</label>
                <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                >
                    <option value="">Select Category</option>
                    <option value="Home Supplies">Home Supplies</option>
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Periodic Expenses">Periodic Expenses</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div>
                <label htmlFor="amount">Amount:</label>
                <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="paidBy">Paid By:</label>
                <select
                    id="paidBy"
                    value={paidBy}
                    onChange={(e) => setPaidBy(e.target.value)}
                    required
                >
                    <option value="">Select Payer</option>
                    {users.length > 0 ? (
                        users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.username}
                            </option>
                        ))
                    ) : (
                        <option value="">No users available</option>
                    )}
                </select>
            </div>
            <button type="submit">Add Expense</button>
        </form>
    );
}

export default AddExpenseForm;
import React, { useState, useEffect } from "react";
import api from "../api/axiosConfig";

const AddExpenseForm = ({ onSuccess, onCancel, expenseId = null, initialData = null }) => {
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [amount, setAmount] = useState("");
    const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [paidBy, setPaidBy] = useState("");
    const [participants, setParticipants] = useState([]);
    const [users, setUsers] = useState([]);
    const [loggedUser, setLoggedUser] = useState(null);
    const [splitMethod, setSplitMethod] = useState("");
    const [splitDetails, setSplitDetails] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");

    const fetchUsers = async () => {
        try {
            const response = await api.get("/users/");
            const sessionResponse = await api.get("/check-session/");
            setUsers(response.data);
            setLoggedUser(sessionResponse.data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const resetForm = () => {
        setName("");
        setCategory("");
        setAmount("");
        setExpenseDate(new Date().toISOString().split("T")[0]);
        setPaidBy("");
        setParticipants([]);
        setSplitMethod("");
        setSplitDetails([]);
        setErrorMessage("");
    };

    const resetSplitDetails = () => {
        const allParticipants = [loggedUser?.id, ...participants];
        const amountNumber = parseFloat(amount) || 0;
        const defaultValue = splitMethod === "shares" ? 1 : 0;
    
        const updatedDetails = allParticipants.map((id) => ({
            id,
            value: defaultValue,
        }));
    
        setSplitDetails(updatedDetails);
    
        // Automatically calculate the last field for "manual" and "percentage"
        if (splitMethod === "manual" || splitMethod === "percentage") {
            const sum = updatedDetails.slice(0, -1).reduce((acc, detail) => acc + detail.value, 0);
            const lastValue =
                splitMethod === "manual" ? Math.max(amountNumber - sum, 0) : Math.max(100 - sum, 0);
    
            setSplitDetails((prev) =>
                prev.map((detail, index) =>
                    index === updatedDetails.length - 1 ? { ...detail, value: lastValue } : detail
                )
            );
        }
    };

    useEffect(() => {
        resetSplitDetails();
    }, [participants, loggedUser, splitMethod]);

    // Prefill when editing
    useEffect(() => {
        if (!expenseId || !initialData || !loggedUser) return;

        setName(initialData.name || "");
        setCategory(initialData.category || "");
        setAmount(initialData.amount || "");
        setExpenseDate(initialData.expense_date || new Date().toISOString().split("T")[0]);
        setPaidBy(initialData.paid_by || "");
        setSplitMethod(initialData.split_method || "");

        // participants: remove logged user from the selectable list (since we always include logged user)
        const others = (initialData.participants || []).filter((id) => id !== loggedUser.id);
        setParticipants(others);

        if (initialData.splits) {
            const mapped = initialData.splits.map((s) => ({
                id: s.user,
                value: s.value ?? (parseFloat(s.owed_amount) || 0),
            }));
            setSplitDetails(mapped);
        }
    }, [expenseId, initialData, loggedUser]);

    const validateSplitDetails = () => {
        const sum = splitDetails.reduce((acc, detail) => acc + (detail.value || 0), 0);
        if (splitMethod === "manual" && sum > parseFloat(amount)) {
            setErrorMessage("The sum of manual amounts cannot exceed the total amount.");
            return false;
        }
        if (splitMethod === "percentage" && sum > 100) {
            setErrorMessage("The sum of percentages cannot exceed 100.");
            return false;
        }
        setErrorMessage("");
        return true;
    };

    const handleInputChange = (id, value) => {
        if (/^\d{0,16}(\.\d{0,2})?$/.test(value)) { // Allow numbers with up to 2 decimal points
            const amountNumber = parseFloat(amount) || 0;
            const numericValue = Math.max(parseFloat(value) || 0, 0);
            const updatedDetails = splitDetails.map((detail) =>
                detail.id === id ? { ...detail, value: numericValue } : detail
            );

            if (splitMethod === "manual" || splitMethod === "percentage") {
                const totalAllocated = updatedDetails
                    .slice(0, -1) // Exclude the last field
                    .reduce((acc, detail) => acc + detail.value, 0);

                // Update the last field dynamically
                const lastFieldIndex = updatedDetails.length - 1;
                updatedDetails[lastFieldIndex] = {
                    ...updatedDetails[lastFieldIndex],
                    value: splitMethod === "manual"
                        ? Math.max(amountNumber - totalAllocated, 0) // Remaining amount
                        : Math.max(100 - totalAllocated, 0), // Remaining percentage
                };
            }

            // Validate total sum
            const finalSum = updatedDetails.reduce((acc, detail) => acc + detail.value, 0);
    
            if (splitMethod === "manual") {
                if (finalSum > parseFloat(amount)) {
                    setErrorMessage("The sum of manual amounts cannot exceed the total amount.");
                } else {
                    setErrorMessage(""); // Clear error for valid inputs
                }
            } else if (splitMethod === "percentage") {
                if (finalSum > 100) {
                    setErrorMessage("The sum of percentages cannot exceed 100.");
                } else {
                    setErrorMessage(""); // Clear error for valid inputs
                }
            }
    
            setSplitDetails(updatedDetails);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
    
        if (!validateSplitDetails()) return;

        const allParticipants = [loggedUser?.id, ...participants].filter(Boolean);
        const uniqueParticipants = Array.from(new Set(allParticipants));
        const amountNumber = parseFloat(amount) || 0;
    
        let payloadSplits = splitDetails.map((split) => ({
            user: split.id, // Ensure the ID matches the backend
            value: split.value, // Needed for percentage/shares calculations in backend
            owed_amount: split.value.toFixed(2), // Consistency in decimal points
            paid_amount: split.id === parseInt(paidBy, 10) ? parseFloat(amount).toFixed(2) : "0.00",
        }));
        let paidByOverride = null;

        if (splitMethod === "full_owed" && uniqueParticipants.length === 2) {
            const otherId = uniqueParticipants.find((id) => id !== loggedUser?.id);
            payloadSplits = [
                { user: loggedUser.id, value: 0, owed_amount: "0.00", paid_amount: amountNumber.toFixed(2) },
                { user: otherId, value: 0, owed_amount: amountNumber.toFixed(2), paid_amount: "0.00" },
            ];
            paidByOverride = loggedUser.id;
        } else if (splitMethod === "full_owe" && uniqueParticipants.length === 2) {
            const otherId = uniqueParticipants.find((id) => id !== loggedUser?.id);
            payloadSplits = [
                { user: loggedUser.id, value: 0, owed_amount: amountNumber.toFixed(2), paid_amount: "0.00" },
                { user: otherId, value: 0, owed_amount: "0.00", paid_amount: amountNumber.toFixed(2) },
            ];
            paidByOverride = otherId;
        }

        const payload = {
            name,
            category,
            amount: parseFloat(amount).toFixed(2), // Ensure proper formatting
            expense_date: expenseDate,
            paid_by: paidByOverride !== null ? paidByOverride : parseInt(paidBy, 10),
            split_method: splitMethod,
            participants: uniqueParticipants,
            splits: payloadSplits,
        };
    
        console.log("Payload:", payload);
    
        try {
            const response = expenseId
                ? await api.put(`/expenses/${expenseId}/`, payload)
                : await api.post("/expenses/", payload);
            console.log("Expense added successfully:", response.data);
            if (onSuccess) {
                onSuccess();
            }
            resetForm();
        } catch (error) {
            console.error("Error adding expense:", error);
            setErrorMessage("Failed to add expense. Please try again.");
        }
    };

    const renderSplitDetails = () => {
        const allParticipants = [loggedUser?.id, ...participants];

        const descriptions = {
            equal: "Split the amount equally among all participants.",
            manual: "Manually specify the amount each participant pays.",
            percentage: "Specify the percentage each participant pays.",
            shares: "Allocate shares to divide the total proportionally.",
            excess: "Adjust the total with specified excess contributions.",
            full_owed: "You cover the full amount; the other person owes you 100%.",
            full_owe: "The other person covers the full amount; you owe 100%.",
        };

        if (splitMethod === "equal") {
            return <p>{descriptions[splitMethod]}</p>;
        }
        if (splitMethod === "full_owed" || splitMethod === "full_owe") {
            return <p>{descriptions[splitMethod]}</p>;
        }
    
        const calculateLastField = (id) => {
            const amountNumber = parseFloat(amount) || 0;
            const otherTotal = splitDetails
                .filter((detail) => detail.id !== id)
                .reduce((acc, detail) => acc + (detail.value || 0), 0);
    
            if (splitMethod === "manual") {
                return Math.max(amountNumber - otherTotal, 0);
            }
            if (splitMethod === "percentage") {
                return Math.max(100 - otherTotal, 0);
            }
            return splitDetails.find((detail) => detail.id === id)?.value || 0;
        };
    
        return (
            <div>
                <p>{descriptions[splitMethod]}</p>
                {allParticipants.map((id, index) => (
                    <div key={id}>
                        <label>
                            {users.find((user) => user.id === id)?.username || "Unknown"}:
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                                index === allParticipants.length - 1 &&
                                (splitMethod === "manual" || splitMethod === "percentage")
                                    ? calculateLastField(id)
                                    : splitDetails.find((detail) => detail.id === id)?.value || 0
                            }
                            onChange={(e) => handleInputChange(id, e.target.value)}
                            disabled={
                                index === allParticipants.length - 1 &&
                                (splitMethod === "manual" || splitMethod === "percentage")
                            }
                        />
                    </div>
                ))}
                {errorMessage && <p className="error-message">{errorMessage}</p>}
            </div>
        );
    };

    if (!loggedUser || !users.length) {
        return <p>Loading form...</p>;
    }

    return (
        <form className="expense-form" onSubmit={handleSubmit}>
            <h2>Add New Expense</h2>
            <div>
                <label>Expense Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
                <label>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} required>
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
                <label>Amount</label>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
            </div>
            <div>
                <label>Expense Date</label>
                <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                />
            </div>
            <div>
                <label>Participants</label>
                <select
                    multiple
                    value={participants}
                    onChange={(e) =>
                        setParticipants([...e.target.selectedOptions].map((option) => parseInt(option.value)))
                    }
                >
                    {users
                        .filter((user) => user.id !== loggedUser?.id)
                        .map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.username}
                            </option>
                        ))}
                </select>
            </div>
            <div>
                <label>Paid By</label>
                <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
                    <option value="">Select Payer</option>
                    {[loggedUser, ...users.filter((user) => participants.includes(user.id))]
                        .filter(Boolean)
                        .map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.username}
                            </option>
                        ))}
                </select>
            </div>
            <div>
                <label>Splitting Method</label>
                <select value={splitMethod} onChange={(e) => setSplitMethod(e.target.value)} required>
                    <option value="">Select Splitting Method</option>
                    <option value="equal">Split Equally</option>
                    <option value="manual">Manual Amount Entry</option>
                    <option value="percentage">Percentage</option>
                    <option value="shares">Shares</option>
                    <option value="excess">Excess Adjustment</option>
                    {participants.length === 1 && (
                        <>
                            <option value="full_owed">You are owed the full amount</option>
                            <option value="full_owe">You owe the full amount</option>
                        </>
                    )}
                </select>
            </div>
            {splitMethod && <div>{renderSplitDetails()}</div>}
            <div className="form-actions">
                <button type="submit">Add Expense</button>
                {onCancel && (
                    <button type="button" className="secondary-button" onClick={onCancel}>
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};

export default AddExpenseForm;

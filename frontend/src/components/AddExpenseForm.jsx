import React, { useState, useEffect } from "react";
import api from "../api/axiosConfig";

const AddExpenseForm = ({ onSuccess, onCancel, expenseId = null, initialData = null }) => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [amount, setAmount] = useState("");
    const getLocalDateISO = () => {
        const now = new Date();
        const offsetMs = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offsetMs).toISOString().split("T")[0];
    };
    const [expenseDate, setExpenseDate] = useState(() => getLocalDateISO());
    const [paidBy, setPaidBy] = useState("");
    const [participants, setParticipants] = useState([]);
    const [users, setUsers] = useState([]);
    const [loggedUser, setLoggedUser] = useState(null);
    const [splitMethod, setSplitMethod] = useState("");
    const [splitDetails, setSplitDetails] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [currency, setCurrency] = useState("ARS");
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [currencySearch, setCurrencySearch] = useState("");
    const currencyLabel = (code) => currencyOptions.find((c) => c.code === code)?.label || code;
    const currencyOptions = [
        { code: "ARS", label: "ARS$", name: "Argentine Peso" },
        { code: "UYU", label: "UYU$", name: "Uruguayan Peso" },
        { code: "CLP", label: "CLP$", name: "Chilean Peso" },
        { code: "MXN", label: "MXN$", name: "Mexican Peso" },
        { code: "BRL", label: "BRL R$", name: "Brazilian Real" },
        { code: "USD", label: "USD$", name: "US Dollar" },
        { code: "EUR", label: "EUR€", name: "Euro" },
        { code: "GBP", label: "GBP£", name: "British Pound" },
        { code: "JPY", label: "JPY¥", name: "Japanese Yen" },
        { code: "PYG", label: "PYG₲", name: "Paraguayan Guarani" },
        { code: "AUD", label: "AUD$", name: "Australian Dollar" },
        { code: "KRW", label: "KRW₩", name: "South Korean Won" },
    ];

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

    useEffect(() => {
        if (loggedUser?.id) {
            setPaidBy(loggedUser.id);
        }
    }, [loggedUser]);

    const resetForm = () => {
        setName("");
        setCategory("");
        setAmount("");
        setExpenseDate(getLocalDateISO());
        setPaidBy("");
        setParticipants([]);
        setSplitMethod("");
        setSplitDetails([]);
        setErrorMessage("");
        setCurrency("ARS");
        setStep(1);
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
        setCurrency(initialData.currency || "ARS");
        setStep(2);

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

        // Default payer: logged user if not set
        const payerId = uniqueParticipants.length > 1
            ? (parseInt(paidBy, 10) || loggedUser?.id)
            : loggedUser?.id;

        let payloadSplits = splitDetails.map((split) => ({
            user: split.id,
            value: split.value,
            owed_amount: split.value.toFixed(2),
            paid_amount: split.id === payerId ? amountNumber.toFixed(2) : "0.00",
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

        // Personal expense (only self): create a single split and set payer to self
        if (uniqueParticipants.length === 1 && loggedUser?.id) {
            paidByOverride = loggedUser.id;
            payloadSplits = [
                {
                    user: loggedUser.id,
                    value: amountNumber,
                    owed_amount: amountNumber.toFixed(2),
                    paid_amount: amountNumber.toFixed(2),
                },
            ];
            // Force a split method for backend validation
            setSplitMethod((prev) => prev || "equal");
        }

        const payload = {
            name,
            category,
            amount: parseFloat(amount).toFixed(2), // Ensure proper formatting
            expense_date: expenseDate,
            paid_by: paidByOverride !== null ? paidByOverride : payerId,
            split_method: splitMethod || "equal",
            participants: uniqueParticipants,
            currency,
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

    const toggleParticipant = (id) => {
        setParticipants((prev) => {
            const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
            // Ensure paidBy remains valid
            const all = [loggedUser?.id, ...next].filter(Boolean);
            if (!all.includes(Number(paidBy))) {
                setPaidBy(all[0] || "");
            }
            return next;
        });
    };

    const displayParticipants = [loggedUser?.id, ...participants].filter(Boolean);
    const filteredUsersStep1 = users
        .filter((u) => u.id !== loggedUser?.id)
        .filter((u) => {
            const term = userSearch.trim().toLowerCase();
            if (!term) return true;
            const display = (u.display_name || "").toLowerCase();
            const username = (u.username || "").toLowerCase();
            return display.startsWith(term) || username.startsWith(term);
        });

    const filteredUsers = users
        .filter((u) => u.id !== loggedUser?.id)
        .filter((u) => {
            const term = userSearch.trim().toLowerCase();
            if (!term) return false;
            const display = (u.display_name || "").toLowerCase();
            const username = (u.username || "").toLowerCase();
            return display.startsWith(term) || username.startsWith(term);
        });

    const renderStep1 = () => (
        <div className="form-card">
            <h2>Add an expense</h2>
            <p className="subtle">With you and:</p>
            <div className="chip-list">
                <span className="chip self-chip">You</span>
                {participants.map((id) => {
                    const u = users.find((user) => user.id === id);
                    return (
                        <button
                            key={id}
                            className="chip chip-active"
                            onClick={() => toggleParticipant(id)}
                        >
                            {u?.display_name || u?.username}
                        </button>
                    );
                })}
            </div>
            <div className="search-row">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search people"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                />
                {userSearch && (
                    <button
                        type="button"
                        className="clear-button"
                        onClick={() => setUserSearch("")}
                        aria-label="Clear search"
                    >
                        ×
                    </button>
                )}
            </div>
            <div className="search-results">
                {filteredUsersStep1.length === 0 && <p className="subtle">No matches</p>}
                {filteredUsersStep1.map((u) => (
                    <div
                        key={u.id}
                        className="user-result"
                        onClick={() => toggleParticipant(u.id)}
                    >
                        {u.display_name || u.username}
                    </div>
                ))}
            </div>
            <div className="form-actions">
                <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                        setUserSearch("");
                        setStep(2);
                    }}
                >
                    Next
                </button>
                {onCancel && (
                    <button type="button" className="secondary-button" onClick={onCancel}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );

    const renderCurrencyModal = () => (
        showCurrencyModal && (
            <div className="modal-backdrop">
                <div className="modal-card">
                    <h3>Select Currency</h3>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search currency"
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                    />
                    <div className="currency-options">
                        {currencyOptions
                            .filter((opt) => {
                                const term = currencySearch.toLowerCase();
                                return (
                                    !term ||
                                    opt.label.toLowerCase().startsWith(term) ||
                                    opt.code.toLowerCase().startsWith(term) ||
                                    (opt.name && opt.name.toLowerCase().startsWith(term))
                                );
                            })
                            .map((opt) => (
                            <button
                                key={opt.code}
                                className="currency-pill"
                                onClick={() => {
                                    setCurrency(opt.code);
                                    setShowCurrencyModal(false);
                                }}
                            >
                                <span className="currency-left">{opt.label}</span>
                                <span className="currency-right">{opt.name}</span>
                            </button>
                        ))}
                    </div>
                    <div className="form-actions">
                        <button className="secondary-button" onClick={() => setShowCurrencyModal(false)}>Close</button>
                    </div>
                </div>
            </div>
        )
    );

    const renderStep2 = () => (
        <div className="form-card">
            <h2>Add an expense</h2>
            <p className="subtle">With you and:</p>
            <div className="chip-list">
                <span className="chip self-chip">You</span>
                {participants.map((id) => {
                    const u = users.find((user) => user.id === id);
                    return (
                        <button
                            key={id}
                            className="chip chip-active"
                            onClick={() => toggleParticipant(id)}
                        >
                            {u?.display_name || u?.username}
                        </button>
                    );
                })}
            </div>
            <div className="search-row">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Add more people"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                />
                {userSearch && (
                    <button
                        type="button"
                        className="clear-button"
                        onClick={() => setUserSearch("")}
                        aria-label="Clear search"
                    >
                        ×
                    </button>
                )}
            </div>
            {userSearch.trim() && (
                <div className="search-results">
                    {filteredUsers.length === 0 && <p className="subtle">No matches</p>}
                    {filteredUsers.map((u) => (
                        <div
                            key={u.id}
                            className="user-result"
                            onClick={() => toggleParticipant(u.id)}
                        >
                            {u.display_name || u.username}
                        </div>
                    ))}
                </div>
            )}
            <form className="expense-form" onSubmit={handleSubmit}>
                <div>
                    <label>Description</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="amount-row">
                    <div className="currency-field">
                        <label>Currency</label>
                        <button type="button" className="currency-button" onClick={() => setShowCurrencyModal(true)}>
                            {currencyLabel(currency)}
                        </button>
                    </div>
                    <div className="amount-field">
                        <label>Amount</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
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
                <div className="two-col">
                    <div>
                        <label>Expense Date</label>
                        <input
                            type="date"
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                            required
                        />
                    </div>
                    {displayParticipants.length > 1 && (
                        <div>
                            <label>Paid By</label>
                            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
                                <option value="">Select Payer</option>
                                {displayParticipants.map((pid) => {
                                    const u = users.find((x) => x.id === pid) || loggedUser;
                                    return (
                                        <option key={pid} value={pid}>
                                            {u?.display_name || u?.username}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}
                </div>

                {displayParticipants.length > 1 && (
                    <>
                        <div className="split-quick">
                            <p>Split options</p>
                            <div className="split-buttons">
                                <button type="button" className={splitMethod === "equal" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("equal")}>Equal</button>
                                <button type="button" className={splitMethod === "manual" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("manual")}>Exact</button>
                                <button type="button" className={splitMethod === "percentage" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("percentage")}>%</button>
                                <button type="button" className={splitMethod === "shares" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("shares")}>Shares</button>
                                {participants.length === 1 && (
                                    <>
                                        <button type="button" className={splitMethod === "full_owed" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("full_owed")}>You owed 100%</button>
                                        <button type="button" className={splitMethod === "full_owe" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("full_owe")}>You owe 100%</button>
                                    </>
                                )}
                                <button type="button" className={splitMethod === "excess" ? "split-btn active" : "split-btn"} onClick={() => setSplitMethod("excess")}>Adjust</button>
                            </div>
                        </div>

                        {splitMethod && <div>{renderSplitDetails()}</div>}
                    </>
                )}
                <div className="form-actions">
                    <button type="submit">Save</button>
                    {onCancel && (
                        <button type="button" className="secondary-button" onClick={onCancel}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>
            {renderCurrencyModal()}
        </div>
    );

    return step === 1 ? renderStep1() : renderStep2();
};

export default AddExpenseForm;

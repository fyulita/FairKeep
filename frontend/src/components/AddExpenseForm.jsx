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
    const [excessSigns, setExcessSigns] = useState({});
    const [currency, setCurrency] = useState("ARS");
    const [showCurrencyModal, setShowCurrencyModal] = useState(false);
    const [userSearch, setUserSearch] = useState("");
    const [currencySearch, setCurrencySearch] = useState("");
    const currencyLabel = (code) => currencyOptions.find((c) => c.code === code)?.label || code;
    const currencyOptions = [
        { code: "ARS", label: "ARS$", name: "Argentine Peso" },
        { code: "AUD", label: "AUD$", name: "Australian Dollar" },
        { code: "BRL", label: "BRL R$", name: "Brazilian Real" },
        { code: "GBP", label: "GBP£", name: "British Pound" },
        { code: "CLP", label: "CLP$", name: "Chilean Peso" },
        { code: "EUR", label: "EUR€", name: "Euro" },
        { code: "JPY", label: "JPY¥", name: "Japanese Yen" },
        { code: "MXN", label: "MXN$", name: "Mexican Peso" },
        { code: "PYG", label: "PYG₲", name: "Paraguayan Guarani" },
        { code: "KRW", label: "KRW₩", name: "South Korean Won" },
        { code: "USD", label: "USD$", name: "US Dollar" },
        { code: "UYU", label: "UYU$", name: "Uruguayan Peso" },
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
        setExcessSigns(
            updatedDetails.reduce((acc, detail) => {
                acc[detail.id] = detail.value < 0 || Object.is(detail.value, -0) ? -1 : 1;
                return acc;
            }, {})
        );

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
            setExcessSigns(
                mapped.reduce((acc, detail) => {
                    acc[detail.id] = detail.value < 0 || Object.is(detail.value, -0) ? -1 : 1;
                    return acc;
                }, {})
            );
        }
    }, [expenseId, initialData, loggedUser]);

    const valueToNumber = (val) => {
        if (typeof val === "number") return val;
        const parsed = parseFloat(val);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const validateSplitDetails = () => {
        const sum = splitDetails.reduce((acc, detail) => acc + valueToNumber(detail.value), 0);
        const amountNumber = parseFloat(amount) || 0;

        if (splitMethod === "manual" && sum > amountNumber) {
            setErrorMessage("The sum of manual amounts cannot exceed the total amount.");
            return false;
        }
        if (splitMethod === "percentage" && sum > 100) {
            setErrorMessage("The sum of percentages cannot exceed 100.");
            return false;
        }
        if (splitMethod === "excess" && amountNumber > 0 && Math.abs(sum) > amountNumber) {
            setErrorMessage("Total excess cannot exceed the total amount (absolute value).");
            return false;
        }
        setErrorMessage("");
        return true;
    };

    const handleInputChange = (id, value) => {
        const allowToggleSign = splitMethod === "excess";
        const numericPattern = /^\d{0,16}(\.\d{0,2})?$/;
        if (!numericPattern.test(value)) return; // digits + optional decimal only

        const amountNumber = parseFloat(amount) || 0;
        const hasAmount = amount !== "" && !Number.isNaN(parseFloat(amount));
        const parsedValue = parseFloat(value);
        const numericValue = Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : 0;
        const isEmpty = value === "";

        setSplitDetails((prevDetails) => {
            const currentDetail = prevDetails.find((d) => d.id === id);
            const isNegativeStored = currentDetail ? currentDetail.value < 0 || Object.is(currentDetail.value, -0) : false;
            const storedSign = isNegativeStored ? -1 : 1;
            const currentSign = allowToggleSign ? (excessSigns[id] ?? storedSign) : 1;

            let nextDetails = prevDetails.map((detail) =>
                detail.id === id
                    ? { ...detail, value: allowToggleSign ? currentSign * numericValue : isEmpty ? "" : numericValue }
                    : detail
            );

            if ((splitMethod === "manual" || splitMethod === "percentage") && nextDetails.length > 1) {
                const targetTotal = splitMethod === "percentage" ? 100 : hasAmount ? amountNumber : null;
                if (targetTotal !== null) {
                    const editedIndex = nextDetails.findIndex((detail) => detail.id === id);
                    const balancerIndex = nextDetails.findIndex((_, idx) => idx !== editedIndex);

                    if (editedIndex !== -1 && balancerIndex !== -1) {
                        const otherSum = nextDetails.reduce((acc, detail, idx) => {
                            if (idx === editedIndex || idx === balancerIndex) return acc;
                            return acc + valueToNumber(detail.value);
                        }, 0);

                        const maxForEdited = Math.max(targetTotal - otherSum, 0);
                        const editedValue = Math.min(numericValue, maxForEdited);
                        nextDetails[editedIndex] = { ...nextDetails[editedIndex], value: isEmpty ? "" : editedValue };

                        const remaining = Math.max(targetTotal - (otherSum + editedValue), 0);
                        nextDetails[balancerIndex] = {
                            ...nextDetails[balancerIndex],
                            value: parseFloat(remaining.toFixed(2)),
                        };
                    }
                }
            } else if (splitMethod === "excess" && hasAmount) {
                const editedIndex = nextDetails.findIndex((detail) => detail.id === id);
                if (editedIndex !== -1) {
                    const otherSum = nextDetails.reduce((acc, detail, idx) => {
                        if (idx === editedIndex) return acc;
                        return acc + valueToNumber(detail.value);
                    }, 0);
                    const maxMagnitude = Math.max(amountNumber - Math.abs(otherSum), 0);
                    const clamped = Math.min(numericValue, maxMagnitude);
                    const signedClamped = currentSign === -1 ? -clamped : clamped;
                    nextDetails[editedIndex] = { ...nextDetails[editedIndex], value: isEmpty ? "" : signedClamped };
                    setExcessSigns((prev) => ({ ...prev, [id]: currentSign }));
                }
            }

            const finalSum = nextDetails.reduce((acc, detail) => acc + valueToNumber(detail.value), 0);

            if (splitMethod === "manual" && hasAmount) {
                setErrorMessage(finalSum > amountNumber ? "The sum of manual amounts cannot exceed the total amount." : "");
            } else if (splitMethod === "percentage") {
                setErrorMessage(finalSum > 100 ? "The sum of percentages cannot exceed 100." : "");
            } else if (splitMethod === "excess" && hasAmount) {
                setErrorMessage(Math.abs(finalSum) > amountNumber ? "Total excess cannot exceed the total amount (absolute value)." : "");
            } else {
                setErrorMessage("");
            }

            return nextDetails;
        });
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
            value: valueToNumber(split.value),
            owed_amount: valueToNumber(split.value).toFixed(2),
            paid_amount: split.id === payerId ? amountNumber.toFixed(2) : "0.00",
        }));
        let paidByOverride = null;

        if (splitMethod === "full_owed" && uniqueParticipants.length >= 2) {
            const others = uniqueParticipants.filter((id) => id !== payerId);
            const share = others.length ? amountNumber / others.length : 0;
            payloadSplits = uniqueParticipants.map((id) => ({
                user: id,
                value: others.includes(id) ? share : 0,
                owed_amount: others.includes(id) ? share.toFixed(2) : "0.00",
                paid_amount: id === payerId ? amountNumber.toFixed(2) : "0.00",
            }));
            paidByOverride = payerId;
        } else if (splitMethod === "full_owe" && uniqueParticipants.length >= 2) {
            const otherId = uniqueParticipants.find((id) => id !== loggedUser?.id);
            const share = uniqueParticipants.length ? amountNumber / uniqueParticipants.length : 0;
            payloadSplits = uniqueParticipants.map((id) => ({
                user: id,
                value: share,
                owed_amount: id === loggedUser?.id ? share.toFixed(2) : "0.00",
                paid_amount: id === otherId ? amountNumber.toFixed(2) : "0.00",
            }));
            paidByOverride = otherId || payerId;
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

        const payerId = Number(paidBy) || loggedUser?.id;
        const payerName = users.find((u) => u.id === payerId)?.display_name || users.find((u) => u.id === payerId)?.username || "Selected payer";

        const descriptions = {
            equal: "Split the amount equally among all participants.",
            manual: "Manually specify the amount each participant pays.",
            percentage: "Specify the percentage each participant pays.",
            shares: "Allocate shares to divide the total proportionally. This is useful when splitting across families of different sizes.",
            excess: "Adjust with positive/negative excess. This is useful when someone pays extra/less by some amount.",
            full_owed:
                payerId === loggedUser?.id
                    ? "You paid the full amount; everyone else owes you an equal share."
                    : `${payerName} paid the full amount; everyone else owes them an equal share.`,
            full_owe: "The other person covers the full amount; you owe 100%.",
        };

        if (splitMethod === "equal") {
            return <p>{descriptions[splitMethod]}</p>;
        }
        if (splitMethod === "full_owed" || splitMethod === "full_owe") {
            return <p>{descriptions[splitMethod]}</p>;
        }

        return (
            <div>
                <p>{descriptions[splitMethod]}</p>
                {allParticipants.map((id) => {
                    const currentValueRaw = splitDetails.find((detail) => detail.id === id)?.value;
                    const currentValue = currentValueRaw ?? 0;
                    const isExcess = splitMethod === "excess";
                    const signFromMap = excessSigns[id] ?? (currentValue < 0 || Object.is(currentValue, -0) ? -1 : 1);
                    const displayValue = currentValueRaw === "" ? "" : isExcess ? Math.abs(currentValue) : currentValue;
                    const isNegative = isExcess ? signFromMap === -1 : currentValue < 0 || Object.is(currentValue, -0);
                    return (
                        <div key={id} className="split-row">
                            <label>
                                {users.find((user) => user.id === id)?.display_name || users.find((user) => user.id === id)?.username || "Unknown"}:
                            </label>
                            <div className="split-input-wrap">
                                {isExcess && (
                                    <button
                                        type="button"
                                        className={`sign-toggle ${isNegative ? "negative" : "positive"}`}
                                        onClick={() => toggleExcessSign(id)}
                                        aria-label="Toggle excess sign"
                                    >
                                        {isNegative ? "-" : "+"}
                                    </button>
                                )}
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={displayValue}
                                    onFocus={() => handleInputFocus(id)}
                                    onChange={(e) => handleInputChange(id, e.target.value)}
                                />
                            </div>
                        </div>
                    );
                })}
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

    const handleInputFocus = (id) => {
        setSplitDetails((prev) =>
            prev.map((detail) =>
                detail.id === id && (detail.value === 0 || detail.value === "0")
                    ? { ...detail, value: "" }
                    : detail
            )
        );
    };

    const toggleExcessSign = (id) => {
        if (splitMethod !== "excess") return;
        const amountNumber = parseFloat(amount) || 0;
        setSplitDetails((prevDetails) => {
            const editedIndex = prevDetails.findIndex((detail) => detail.id === id);
            if (editedIndex === -1) return prevDetails;
            const otherSum = prevDetails.reduce((acc, detail, idx) => {
                if (idx === editedIndex) return acc;
                return acc + (detail.value || 0);
            }, 0);
            const maxMagnitude = Math.max(amountNumber - Math.abs(otherSum), 0);
            const current = prevDetails[editedIndex].value ?? 0;
            const flipped = -current;
            const sign = flipped < 0 || Object.is(flipped, -0) ? -1 : 1;
            const clamped = Math.min(Math.abs(flipped), maxMagnitude);
            const signedClamped = sign === -1 ? -clamped : clamped;
            setExcessSigns((prev) => ({ ...prev, [id]: sign }));
            return prevDetails.map((detail, idx) =>
                idx === editedIndex ? { ...detail, value: signedClamped } : detail
            );
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
    const filteredUsersStep2 = users
        .filter((u) => u.id !== loggedUser?.id)
        .filter((u) => {
            const term = userSearch.trim().toLowerCase();
            if (!term) return false;
            const display = (u.display_name || "").toLowerCase();
            const username = (u.username || "").toLowerCase();
            return display.startsWith(term) || username.startsWith(term);
        });

    const renderStep1 = () => (
        <div className="page-container add-expense-screen">
            <h2 className="add-expense-title">Add an expense</h2>
            <p className="subtle with-label">With</p>
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
        <div className="page-container add-expense-screen">
            <h2 className="add-expense-title">Add an expense</h2>
            <div className="add-expense-top">
                <div className="with-row">
                    <p className="subtle with-label">With</p>
                    <div className="chip-list inline-chips">
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
                        {filteredUsersStep2.length === 0 && <p className="subtle">No matches</p>}
                        {filteredUsersStep2.map((u) => (
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
            </div>
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
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                </div>
                <div className="two-col">
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
                        <label>Expense Date</label>
                        <input
                            type="date"
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {displayParticipants.length > 1 && (
                    <>
                        <div className="two-col">
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
                            <div>
                                <label>Split Options</label>
                                <select
                                    value={splitMethod}
                                    onChange={(e) => setSplitMethod(e.target.value)}
                                    required
                                >
                                    <option value="">Select split</option>
                                    {Number(paidBy || loggedUser?.id) === loggedUser?.id ? (
                                        <>
                                            <option value="equal">Equal Splitting</option>
                                            <option value="full_owed">You are owed the Full Amount</option>
                                            <option value="manual">Exact Amount</option>
                                            <option value="percentage">By Percentages</option>
                                            <option value="shares">By Shares</option>
                                            <option value="excess">Excess Amount</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="equal">Equal Splitting</option>
                                            <option value="full_owed">They are owed the Full Amount</option>
                                            <option value="manual">Exact Amount</option>
                                            <option value="percentage">By Percentages</option>
                                            <option value="shares">By Shares</option>
                                            <option value="excess">Excess Amount</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        {splitMethod && <div>{renderSplitDetails()}</div>}
                    </>
                )}
            <div className="form-actions centered-actions">
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

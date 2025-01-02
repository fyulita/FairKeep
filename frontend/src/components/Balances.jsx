import { useEffect, useState } from "react";
import api from "../api/axiosConfig";

function Balances() {
    const [balances, setBalances] = useState([]);

    const fetchBalances = async () => {
        try {
            const response = await api.get("balances/");
            setBalances(response.data);
        } catch (error) {
            console.error("Error fetching balances:", error);
        }
    };

    useEffect(() => {
        fetchBalances();
    }, []);

    return (
        <div>
            <h2>Balances</h2>
            <ul>
                {balances.length > 0 ? (
                    balances.map((balance, index) => (
                        <li key={index}>
                            {balance.amount > 0
                                ? `You owe ${balance.user} ${balance.amount}`
                                : `${balance.user} owes you ${-balance.amount}`}
                        </li>
                    ))
                ) : (
                    <p>No balances to show</p>
                )}
            </ul>
        </div>
    );
}

export default Balances;
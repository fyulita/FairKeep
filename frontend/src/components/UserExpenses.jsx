import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axiosConfig";
import Expenses from "./Expenses";

function UserExpenses({ currentUserId, refreshKey }) {
    const { userId } = useParams();
    const [username, setUsername] = useState("");

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await api.get("users/");
                const target = response.data.find((u) => String(u.id) === String(userId));
                if (target) setUsername(target.display_name || target.username);
            } catch (error) {
                console.error("Error fetching user:", error);
                setUsername(userId);
            }
        };
        fetchUser();
    }, [userId]);

    return (
        <div>
            <Expenses
                title={`Expenses with ${username || "user"}`}
                refreshKey={refreshKey}
                filterUserId={userId}
                currentUserId={currentUserId}
            />
        </div>
    );
}

export default UserExpenses;

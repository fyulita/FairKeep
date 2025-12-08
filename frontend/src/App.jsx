import { useState, useEffect } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import api from "./api/axiosConfig";
import Login from "./components/Login";
import Expenses from "./components/Expenses";
import UserList from "./components/UserList";
import UserExpenses from "./components/UserExpenses";
import ExpenseDetail from "./components/ExpenseDetail";
import EditExpense from "./components/EditExpense";
import Activities from "./components/Activities";
import AddExpenseForm from "./components/AddExpenseForm";
import BottomNav from "./components/BottomNav";
import UserProfile from "./components/UserProfile";
import Contacts from "./components/Contacts";
import './styles.css';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expensesVersion, setExpensesVersion] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);
    const navigate = useNavigate();

    const checkSession = async () => {
        try {
            const response = await api.get("check-session/");
            setIsLoggedIn(response.data.authenticated);
            if (response.data.authenticated) {
                setCurrentUser({ id: response.data.id, username: response.data.username, display_name: response.data.display_name });
            } else {
                setCurrentUser(null);
            }
        } catch {
            setIsLoggedIn(false);
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            checkSession();
        }
    }, [isLoggedIn]);

    const logout = async () => {
        try {
            await api.post("logout/");
            setIsLoggedIn(false);
            setCurrentUser(null);
            navigate("/");
        } catch (error) {
            console.error("Error during logout:", error);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (!isLoggedIn) {
        return <Login setIsLoggedIn={setIsLoggedIn} onLoginSuccess={checkSession} />;
    }

    return (
        <div className="app-shell">
            <div className="app-content">
                <Routes>
                    <Route
                        path="/"
                        element={
                            <>
                                <UserList currentUserId={currentUser?.id} refreshKey={expensesVersion} />
                                <Link className="fab-add-expense" to="/add-expense">＋</Link>
                            </>
                        }
                    />
                    <Route
                        path="/add-expense"
                        element={
                            <AddExpenseForm
                                onSuccess={() => {
                                    setExpensesVersion((v) => v + 1);
                                    navigate("/");
                                }}
                                onCancel={() => navigate("/")}
                            />
                        }
                    />
                    <Route
                        path="/with/:userId"
                        element={
                            <UserExpenses
                                currentUserId={currentUser?.id}
                                refreshKey={expensesVersion}
                            />
                        }
                    />
                    <Route
                    path="/expenses"
                    element={
                        <Expenses
                            title="All My Expenses"
                            refreshKey={expensesVersion}
                            currentUserId={currentUser?.id}
                            onlyCurrentUser
                        />
                    }
                />
                <Route
                    path="/expenses/:expenseId"
                    element={
                        <ExpenseDetail
                            currentUserId={currentUser?.id}
                        />
                    }
                />
                <Route
                    path="/expenses/:expenseId/edit"
                    element={
                        <EditExpense onDone={() => navigate(-1)} />
                    }
                />
                <Route
                    path="/activities"
                    element={<Activities />}
                />
                <Route
                    path="/user"
                    element={<UserProfile logout={logout} />}
                />
                <Route
                    path="/contacts"
                    element={<Contacts />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </div>
            <BottomNav />
        </div>
    );
}

export default App;

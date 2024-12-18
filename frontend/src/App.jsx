import { useEffect, useState } from "react";
import api from "./api/axiosConfig";
import './styles.css';

function Navbar() {
    return (
      <nav style={{ backgroundColor: '#6200ee', padding: '10px' }}>
        <h2 style={{ color: 'white', textAlign: 'center', margin: 0 }}>Expense Tracker</h2>
      </nav>
    );
}

function Footer() {
  return (
    <footer style={{ textAlign: 'center', marginTop: '20px', padding: '10px', background: '#6200ee', color: 'white' }}>
      <p>© 2024 Expense Tracker. All rights reserved.</p>
    </footer>
  );
}

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
        <div className="main-container">
          <Navbar />
          <h1>Expenses</h1>
          <div className="expense-container">
            {expenses.map((expense) => (
              <div key={expense.id} className="expense-item">
                <span>{expense.name}</span>
                <span className="expense-amount">${expense.amount}</span>
              </div>
            ))}
          </div>
          <Footer />
        </div>
      );
}

export default App;
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import PortfolioList from "./pages/PortfolioList";
import PortfolioDetail from "./pages/PortfolioDetail";
import Rebalance from "./pages/Rebalance";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Portfolios</Link>
      </nav>
      <Routes>
        <Route path="/" element={<PortfolioList />} />
        <Route path="/portfolio/:id" element={<PortfolioDetail />} />
        <Route path="/portfolio/:id/rebalance" element={<Rebalance />} />
      </Routes>
    </BrowserRouter>
  );
}

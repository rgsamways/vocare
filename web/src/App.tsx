import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignUpPage } from "./pages/SignUpPage";
import { AccountPage } from "./pages/AccountPage";
import { PaywallPage } from "./pages/PaywallPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignUpPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/paywall" element={<PaywallPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

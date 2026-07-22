import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignUpPage } from "./pages/SignUpPage";
import { AccountPage } from "./pages/AccountPage";
import { PaywallPage } from "./pages/PaywallPage";
import { ConversationPage } from "./pages/ConversationPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignUpPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/paywall" element={<PaywallPage />} />
        <Route path="/practice" element={<ConversationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

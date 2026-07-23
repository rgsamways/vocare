import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignUpPage } from "./pages/SignUpPage";
import { AccountPage } from "./pages/AccountPage";
import { PaywallPage } from "./pages/PaywallPage";
import { ConversationPage } from "./pages/ConversationPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { ProgressPage } from "./pages/ProgressPage";
import { AppShell } from "./components/AppShell";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignUpPage />} />
        <Route path="/paywall" element={<PaywallPage />} />
        <Route element={<AppShell />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/practice" element={<ConversationPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/feedback/:sessionId" element={<FeedbackPage />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

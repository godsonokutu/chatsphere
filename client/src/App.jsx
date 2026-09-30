import {
  Route,
  Routes,
} from "react-router-dom";

import {
  ProtectedRoute,
} from "./auth/ProtectedRoute";

import {
  LoginPage,
} from "./pages/LoginPage";

import {
  RegisterPage,
} from "./pages/RegisterPage.jsx";

import {
  VerifyAccountPage,
} from "./pages/VerifyAccountPage.jsx";

import {
  ChatPage,
} from "./pages/ChatPage";

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />

      <Route
        path="/register"
        element={
          <RegisterPage />
        }
      />

      <Route
        path="/verify"
        element={
          <VerifyAccountPage />
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
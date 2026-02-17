import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardOverviewPage } from "./pages/DashboardOverviewPage";
import { DevicesListPage } from "./pages/DevicesListPage";
import { DeviceLivePage } from "./pages/DeviceLivePage";
import { TechniciansGuidePage } from "./pages/TechniciansGuidePage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RequireAuth } from "./auth/RequireAuth";
import { DeviceStoreProvider } from "./store/deviceStore";

function ProtectedLayout() {
  return (
    <RequireAuth>
      <DeviceStoreProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </DeviceStoreProvider>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardOverviewPage />} />
          <Route path="/devices" element={<DevicesListPage />} />
          <Route path="/devices/:deviceUid" element={<DeviceLivePage />} />
          <Route path="/technicians" element={<TechniciansGuidePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DeviceStoreProvider } from "./store/deviceStore";
import { AppShell } from "./components/layout/AppShell";
import { DashboardOverviewPage } from "./pages/DashboardOverviewPage";
import { DevicesListPage } from "./pages/DevicesListPage";
import { DeviceLivePage } from "./pages/DeviceLivePage";
import { TechniciansGuidePage } from "./pages/TechniciansGuidePage";

export default function App() {
  return (
    <DeviceStoreProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardOverviewPage />} />
            <Route path="/devices" element={<DevicesListPage />} />
            <Route path="/devices/:deviceUid" element={<DeviceLivePage />} />
            <Route path="/technicians" element={<TechniciansGuidePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </DeviceStoreProvider>
  );
}

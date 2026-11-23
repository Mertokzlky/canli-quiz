import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/Layout';
import { AuthProvider } from './lib/auth';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { HomePage } from './pages/Home';
import { QuizEditorPage } from './pages/QuizEditor';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/giris" element={<AuthPage mode="login" />} />
          <Route path="/kayit" element={<AuthPage mode="register" />} />
          <Route element={<AppLayout />}>
            <Route path="/panel" element={<DashboardPage />} />
            <Route path="/quiz/yeni" element={<QuizEditorPage />} />
            <Route path="/quiz/:id/duzenle" element={<QuizEditorPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

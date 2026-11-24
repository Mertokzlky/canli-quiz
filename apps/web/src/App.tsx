import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout, RequireAuth } from './components/Layout';
import { Spinner } from './components/ui';
import { AuthProvider } from './lib/auth';
import { HomePage } from './pages/Home';

// Sayfalar ayrı parçalar halinde, ihtiyaç duyulunca yüklenir. Telefondan katılan bir oyuncu
// editör veya panel kodunu hiç indirmez.
const AuthPage = lazy(() => import('./pages/Auth').then((m) => ({ default: m.AuthPage })));
const DashboardPage = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.DashboardPage })),
);
const GameHistoryPage = lazy(() =>
  import('./pages/GameHistory').then((m) => ({ default: m.GameHistoryPage })),
);
const GameHistoryDetailPage = lazy(() =>
  import('./pages/GameHistoryDetail').then((m) => ({ default: m.GameHistoryDetailPage })),
);
const HostGamePage = lazy(() =>
  import('./pages/HostGame').then((m) => ({ default: m.HostGamePage })),
);
const PlayerGamePage = lazy(() =>
  import('./pages/PlayerGame').then((m) => ({ default: m.PlayerGamePage })),
);
const QuickQuizPage = lazy(() =>
  import('./pages/QuickQuiz').then((m) => ({ default: m.QuickQuizPage })),
);
const QuizEditorPage = lazy(() =>
  import('./pages/QuizEditor').then((m) => ({ default: m.QuizEditorPage })),
);

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/oyun/:pin" element={<PlayerGamePage />} />
            <Route path="/giris" element={<AuthPage mode="login" />} />
            <Route path="/kayit" element={<AuthPage mode="register" />} />
            <Route element={<AppLayout />}>
              <Route path="/panel" element={<DashboardPage />} />
              <Route path="/quiz/yeni" element={<QuizEditorPage />} />
              <Route path="/quiz/hizli" element={<QuickQuizPage />} />
              <Route path="/quiz/:id/duzenle" element={<QuizEditorPage />} />
              <Route path="/gecmis" element={<GameHistoryPage />} />
              <Route path="/gecmis/:id" element={<GameHistoryDetailPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/sunucu/:quizId" element={<HostGamePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

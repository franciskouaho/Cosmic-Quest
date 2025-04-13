import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import { AuthProvider } from './contexts/AuthContext';

// ... dans le composant de layout
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* ... reste du code existant ... */}
      </AuthProvider>
    </QueryClientProvider>
  );
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '../types';
import { withAuthRetry } from '../utils/supabaseRetry';

// Module-level flags to prevent excessive API calls
let hasCheckedSession = false;
let isCheckingSession = false;
let sessionCheckPromise: Promise<void> | null = null;
let hasInitialSessionChecked = false;

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  authToken: string | null;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastTokenRefresh, setLastTokenRefresh] = useState<number>(0);

  // Verificar sessão existente ao carregar
  useEffect(() => {
    const checkSession = async () => {
      // Return early if we've already checked the session initially
      if (hasInitialSessionChecked) {
        setIsLoading(false);
        return;
      }
      
      // Prevent multiple simultaneous session checks
      if (isCheckingSession) {
        console.log('🔄 Sessão já verificada ou em verificação, pulando');
        setIsLoading(false);
        return;
      }
      
      // If there's already a session check in progress, wait for it
      if (sessionCheckPromise) {
        await sessionCheckPromise;
        setIsLoading(false);
        return;
      }
      
      isCheckingSession = true;
      sessionCheckPromise = (async () => {
        try {
          console.log('🔍 Verificando sessão existente...');
          setAuthError(null);
          
          const { data: { session }, error } = await withAuthRetry(() => 
            supabase.auth.getSession()
          );
          
          if (session && session.user && !error) {
            console.log('✅ Sessão encontrada para usuário:', session.user.email);
            const user: User = {
              id: session.user.id,
              username: session.user.email || '',
              password: '', // Não armazenamos senha
              isAdmin: session.user.email === 'droweder@gmail.com',
              createdAt: session.user.created_at || new Date().toISOString(),
            };
            
            setCurrentUser(user);
            setAuthToken(session.access_token);
            setLastTokenRefresh(Date.now());
            console.log('✅ Usuário autenticado automaticamente');
          } else {
            console.log('ℹ️ Nenhuma sessão ativa - usuário precisa fazer login');
            if (error) {
              console.error('❌ Erro ao verificar sessão:', error);
              setAuthError(`Erro de sessão: ${error.message}`);
            }
          }
        } catch (error) {
          setAuthError(`Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          console.error('❌ Erro ao verificar sessão:', error);
        } finally {
          isCheckingSession = false;
          sessionCheckPromise = null;
          hasInitialSessionChecked = true;
        }
      })();
      
      await sessionCheckPromise;
      setIsLoading(false);
    };

    checkSession();

    // Escutar mudanças de autenticação com throttling
    let authStateChangeTimeout: NodeJS.Timeout;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Throttle auth state changes to prevent excessive calls
        clearTimeout(authStateChangeTimeout);
        authStateChangeTimeout = setTimeout(() => {
          console.log('🔄 Mudança de autenticação:', event);
          setAuthError(null);
          
          if (session && session.user) {
            console.log('✅ Usuário logado:', session.user.email);
            const user: User = {
              id: session.user.id,
              username: session.user.email || '',
              password: '',
              isAdmin: session.user.email === 'droweder@gmail.com',
              createdAt: session.user.created_at || new Date().toISOString(),
            };
            
            setCurrentUser(user);
            setAuthToken(session.access_token);
            setLastTokenRefresh(Date.now());
          } else {
            console.log('❌ Usuário deslogado');
            setCurrentUser(null);
            setAuthToken(null);
            setLastTokenRefresh(0);
          }
        }, 500); // 500ms throttle
      }
    );

    return () => {
      clearTimeout(authStateChangeTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    console.log('🔐 Tentativa de login:', { email });
    
    try {
      setAuthError(null);
      const { data: { session }, error } = await withAuthRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );

      if (error) {
        console.error('❌ Erro no login:', error);
        setAuthError(`Erro no login: ${error.message}`);
        return false;
      }

      if (session && session.user) {
        console.log('✅ Login bem sucedido:', session.user.email);
        const user: User = {
          id: session.user.id,
          username: session.user.email || '',
          password: '',
          isAdmin: session.user.email === 'droweder@gmail.com',
          createdAt: session.user.created_at || new Date().toISOString(),
        };

        setCurrentUser(user);
        setAuthToken(session.access_token);
        setLastTokenRefresh(Date.now());
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Erro no login:', error);
      setAuthError(`Erro de conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      return false;
    }
  };

  const logout = async () => {
    try {
      await withAuthRetry(() => supabase.auth.signOut());
      setAuthError(null);
      setCurrentUser(null);
      setAuthToken(null);
      setLastTokenRefresh(0);
      console.log('👋 Logout realizado');
    } catch (error) {
      console.error('❌ Erro no logout:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando autenticação...</p>
          {authError && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-md mx-auto">
              <p className="text-red-700 dark:text-red-400 text-sm">{authError}</p>
              <button
                onClick={() => {
                  setAuthError(null);
                  setIsLoading(false);
                }}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Tentar Login Manual
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        login,
        logout,
        isAuthenticated: !!currentUser,
        authToken,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
import { useState } from 'react';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { login, ApiError } from '../lib/api/auth';

interface LoginPageProps {
  onLogin: () => void;
}

/**
 * Login Page Component
 * FE-AUTH-01: Wired to real authentication API
 */
export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // FE-AUTH-01: Call real API endpoint
      await login({ email, password });

      // Success - trigger parent callback
      onLogin();
    } catch (err) {
      if (err instanceof ApiError) {
        // Handle specific API errors
        if (err.status === 401) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else if (err.status === 429) {
          setError('محاولات كثيرة. الرجاء المحاولة لاحقاً');
        } else {
          setError(err.message || 'حدث خطأ. الرجاء المحاولة مرة أخرى');
        }
      } else {
        setError('حدث خطأ في الاتصال. الرجاء التحقق من الشبكة');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-lg mb-4">
            <span className="text-white text-2xl">R</span>
          </div>
          <h1 className="text-3xl mb-2">Rappit</h1>
          <p className="text-gray-600">مركز عمليات التجارة الإلكترونية</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-2">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm mb-2">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>جاري تسجيل الدخول...</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>حساب تجريبي: استخدم أي بريد إلكتروني وكلمة مرور</p>
        </div>
      </div>
    </div>
  );
}

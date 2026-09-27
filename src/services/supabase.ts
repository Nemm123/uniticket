import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Đọc cấu hình từ biến môi trường Vite
const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Kiểm tra xem Supabase đã được cấu hình đầy đủ bằng biến môi trường hợp lệ chưa
export const isSupabaseConfigured = Boolean(
  envSupabaseUrl &&
  envSupabaseAnonKey &&
  !envSupabaseUrl.includes('placeholder') &&
  envSupabaseUrl.startsWith('http')
);

// Fallback an toàn đảm bảo dApp không bao giờ bị crash nếu thiếu file .env
const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key-safe-fallback-uniticket-2026';

const supabaseUrl = isSupabaseConfigured ? envSupabaseUrl : fallbackUrl;
const supabaseAnonKey = isSupabaseConfigured ? envSupabaseAnonKey : fallbackAnonKey;

/**
 * Supabase client instance kết nối tới database đám mây
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Kiểm tra kết nối Supabase Cloud Health Check
 * Gọi thử truy vấn supabase.from('tickets').select('id').limit(1)
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      message: 'Chưa cấu hình Supabase (Chế độ Local Fallback)',
    };
  }

  const startTime = performance.now();
  try {
    const { error } = await supabase
      .from('tickets')
      .select('id')
      .limit(1);

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      return {
        success: false,
        message: `Lỗi kết nối Supabase: ${error.message}`,
        latencyMs,
      };
    }

    return {
      success: true,
      message: 'Supabase Connected',
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: false,
      message: err?.message ? `Lỗi mạng: ${err.message}` : 'Không thể kết nối tới máy chủ Supabase.',
      latencyMs,
    };
  }
}

export default supabase;

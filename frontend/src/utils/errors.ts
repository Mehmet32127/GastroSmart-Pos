/**
 * Backend'den gelen hata mesajını çıkarır.
 * Axios error response yapısı: err.response.data.error
 *
 * Kullanım:
 *   catch (err) { toast.error(getErrorMessage(err, 'Kayıt başarısız')) }
 */
export function getErrorMessage(err: unknown, fallback = 'Bir hata oluştu'): string {
  const e = err as {
    response?: { data?: { error?: string; errorId?: string } }
    message?: string
    code?: string
  }

  // Backend'in döndüğü mesaj
  const backendError = e?.response?.data?.error
  if (backendError) return backendError

  // Network/timeout hataları için anlamlı mesaj
  if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout')) {
    return 'Bağlantı zaman aşımı, lütfen tekrar deneyin'
  }
  if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error') {
    return 'İnternet bağlantınızı kontrol edin'
  }

  return fallback
}

import { io, type Socket } from 'socket.io-client';
import type { AckResponse, ClientToServerEvents, ServerToClientEvents } from '@canli-quiz/shared';
import { SERVER_URL, tokenStore } from './api';

export type QuizSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Tek bir bağlantı tüm uygulama tarafından paylaşılır. Token her bağlanışta yeniden okunur,
// böylece giriş/çıkış sonrası yeniden bağlanınca doğru kimlik gönderilir.
export const socket: QuizSocket = io(SERVER_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: tokenStore.get() ?? undefined }),
});

type EventWithAck = {
  [E in keyof ClientToServerEvents]: Parameters<ClientToServerEvents[E]>[1] extends (
    response: AckResponse<infer T>,
  ) => void
    ? E
    : never;
}[keyof ClientToServerEvents];

type AckData<E extends EventWithAck> = Parameters<ClientToServerEvents[E]>[1] extends (
  response: AckResponse<infer T>,
) => void
  ? T
  : never;

/** Olayı gönderir ve sunucunun cevabını bekler. Cevap gelmezse anlaşılır bir hata döner. */
export async function request<E extends EventWithAck>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<AckResponse<AckData<E>>> {
  try {
    const timed = socket.timeout(8000);
    // Metot nesnesinden ayrılırsa `this` kaybolur; bu yüzden bind ediyoruz.
    const emit = timed.emitWithAck.bind(timed) as (
      e: E,
      p: typeof payload,
    ) => Promise<AckResponse<AckData<E>>>;
    return await emit(event, payload);
  } catch {
    return { ok: false, error: 'Sunucu cevap vermedi. Bağlantınızı kontrol edin.' };
  }
}

/** Oturum değişince (giriş/çıkış) bağlantıyı yeni token ile kurmak için. */
export function resetSocketAuth() {
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

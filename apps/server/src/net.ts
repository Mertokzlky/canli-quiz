/**
 * İsteği yapan istemcinin IP adresi. Express'in "trust proxy" ayarıyla aynı kuralı uygular:
 * sunucunun önünde `trustedHops` kadar güvenilir ara sunucu (ör. Render'ın yük dengeleyicisi)
 * varsa X-Forwarded-For listesinin sağından o kadar adres atlanır. Güvenilir ara sunucu yoksa
 * başlık yok sayılır; aksi halde herkes başlığa istediği adresi yazıp sınırları aşabilirdi.
 */
export function clientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | string[] | undefined,
  trustedHops: number,
): string {
  const remote = remoteAddress ?? 'bilinmiyor';
  if (trustedHops <= 0 || !forwardedFor) return remote;

  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor;
  const forwarded = header
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  // En yakından en uzağa: önce doğrudan bağlanan ara sunucu, sonra listedeki adresler tersten.
  const chain = [remote, ...forwarded.reverse()];
  return chain[Math.min(trustedHops, chain.length - 1)]!;
}

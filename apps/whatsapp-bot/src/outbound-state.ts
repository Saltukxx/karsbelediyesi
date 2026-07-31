/** Kuyruk job'unun deneme bilgisi (BullMQ Job ile uyumlu alt küme) */
export type DenemeBilgisi = {
  attemptsMade: number;
  opts: { attempts?: number };
};

/**
 * Bu çalıştırma son deneme mi? Son denemede de gönderim başarısızsa mesaj
 * satırı BASARISIZ işaretlenir; aksi halde satır "kuyrukta" kalır ve yeniden
 * denenir. BullMQ attemptsMade'i deneme başlamadan artırmadığı için +1.
 */
export function sonDenemeMi(job: DenemeBilgisi): boolean {
  const toplam = job.opts.attempts ?? 1;
  return job.attemptsMade + 1 >= toplam;
}

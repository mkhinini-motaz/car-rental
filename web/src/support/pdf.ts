import { pdfLink } from '../api/contract';

// Paperwork comes in French or Arabic: Arabic for the Arabic-script app languages.
export const pdfLang = (lang: string): 'fr'|'ar' => lang === 'ar' || lang === 'tnar' ? 'ar' : 'fr';

// Opens a contract's PDF in a new tab (to read, print or download). The tab opens at once, before
// the link comes back, or the browser would block it as a pop-up.
export async function openPdf(contractId: number, kind: 'contract'|'invoice'|'receipt', lang: 'fr'|'ar', paymentId?: number): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const url = await pdfLink(contractId, kind, lang, paymentId);
    if (tab) {
      tab.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}

// The link to send the client: the share sheet where there is one (phones), else the clipboard.
export async function sharePdf(contractId: number, kind: 'contract'|'invoice', lang: 'fr'|'ar'): Promise<'shared'|'copied'> {
  const url = await pdfLink(contractId, kind, lang);
  if (navigator.share) {
    await navigator.share({ url });
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function selectedText() {
  return cleanText(window.getSelection?.().toString());
}

function extractGreenhouse() {
  const titleEl = document.querySelector('.app-title, h1');
  const companyEl = document.querySelector('.company-name, .app-company');
  const descEl = document.querySelector('#content, .content, #main, main, article') || document.body;
  const picked = selectedText();
  const jdText = cleanText(picked || descEl?.innerText || document.body.innerText).slice(0, 16000);
  const warnings = [];
  if (!/greenhouse\.io/i.test(location.hostname)) warnings.push('This does not look like a Greenhouse job URL.');
  if (picked) warnings.push('Used selected text as the primary job description.');
  if (jdText.length < 600) warnings.push('Extracted text is short; screenshot fallback may be needed.');
  return {
    url: location.href,
    title: cleanText(titleEl?.innerText) || document.title,
    company: cleanText(companyEl?.innerText).replace(/^at\s+/i, '') || null,
    jd_text: jdText,
    warnings
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'scrape') {
    try { sendResponse({ ok: true, data: extractGreenhouse() }); }
    catch (e) { sendResponse({ ok: false, error: e.message }); }
  }
  return true;
});

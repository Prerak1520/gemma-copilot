// Scrape the visible LinkedIn job description on /jobs/* pages.
function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function selectedText() {
  return cleanText(window.getSelection?.().toString());
}

function extractLinkedIn() {
  for (const button of document.querySelectorAll('button')) {
    const label = cleanText(button.innerText || button.ariaLabel);
    if (/^(show more|see more|more)$/i.test(label)) button.click();
  }
  const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24, h1');
  const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a, .topcard__org-name-link');
  const selectors = [
    '#job-details',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
    '.jobs-search__job-details--container',
    '.jobs-search__right-rail',
    '.scaffold-layout__detail',
    '.job-view-layout',
    'main'
  ];
  const chunks = selectors
    .map(selector => document.querySelector(selector))
    .filter(Boolean)
    .map(el => cleanText(el.innerText))
    .filter(text => text.length > 80);
  const longest = chunks.sort((a, b) => b.length - a.length)[0] || '';
  const picked = selectedText();
  const jdText = cleanText(picked || longest || document.body.innerText).slice(0, 20000);
  const warnings = [];
  if (!location.pathname.includes('/jobs/')) warnings.push('This does not look like a LinkedIn job URL.');
  if (picked) warnings.push('Used selected text as the primary job description.');
  if (jdText.length < 600) warnings.push(`Extracted only ${jdText.length} characters from LinkedIn; open the job details pane or select the JD text.`);
  return {
    url: location.href,
    title: cleanText(titleEl?.innerText) || document.title,
    company: cleanText(companyEl?.innerText) || null,
    jd_text: jdText,
    scrape_source: picked ? 'selection' : longest ? 'linkedin-detail' : 'body',
    scrape_length: jdText.length,
    warnings
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'scrape') {
    try { sendResponse({ ok: true, data: extractLinkedIn() }); }
    catch (e) { sendResponse({ ok: false, error: e.message }); }
  }
  return true;
});

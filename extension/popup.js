const API = 'http://localhost:3939';
let currentRunId = null;
let currentJobId = null;
let lastScraped = null;

const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');
const setStage = text => { $('stage').textContent = text; };

function addPill(parent, text, severity) {
  const pill = document.createElement('span');
  const sev = severity === 'high' || severity === 'med' || severity === 'medium' || severity === 'low'
    ? severity.replace('medium', 'med')
    : '';
  pill.className = sev ? `pill ${sev}` : 'pill';
  pill.textContent = text;
  parent.appendChild(pill);
}

async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`);
    const data = await r.json();
    $('status-dot').classList.add('ok');
    $('status-dot').classList.remove('bad');
    $('model-info').textContent = data.ollama?.missing?.length
      ? `${data.edge} · missing ${data.ollama.missing.join(', ')}`
      : `${data.edge}`;
  } catch {
    $('status-dot').classList.add('bad');
    $('status-dot').classList.remove('ok');
    $('model-info').textContent = 'API offline';
  }
}

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

async function captureScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return null;
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch {
    return null;
  }
}

async function scrapeActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab.');

  const url = tab.url || '';

  // Pick scraper based on URL — injected on demand so no page refresh needed
  let scraper;
  if (url.includes('linkedin.com/jobs')) {
    scraper = () => {
      const cleanText = text => (text || '').replace(/\s+/g, ' ').trim();
      const picked = cleanText(window.getSelection?.().toString());
      const clickMore = () => {
        for (const button of document.querySelectorAll('button')) {
          const label = cleanText(button.innerText || button.ariaLabel);
          if (/^(show more|see more|more)$/i.test(label)) button.click();
        }
      };
      clickMore();
      const titleEl = document.querySelector(
        '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24, h1'
      );
      const companyEl = document.querySelector(
        '.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a, .topcard__org-name-link'
      );
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
      const jdText = cleanText(picked || longest || document.body.innerText).slice(0, 20000);
      const warnings = [];
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
    };
  } else if (url.includes('greenhouse.io')) {
    scraper = () => {
      const cleanText = text => (text || '').replace(/\s+/g, ' ').trim();
      const picked = cleanText(window.getSelection?.().toString());
      const titleEl = document.querySelector('.app-title, h1');
      const companyEl = document.querySelector('.company-name, .app-company');
      const descEl = document.querySelector('#content, .content, #main, main, article') || document.body;
      const jdText = cleanText(picked || descEl?.innerText || document.body.innerText).slice(0, 16000);
      const warnings = [];
      if (picked) warnings.push('Used selected text as the primary job description.');
      if (jdText.length < 600) warnings.push('Extracted text is short; screenshot fallback may be needed.');
      return {
        url: location.href,
        title: cleanText(titleEl?.innerText) || document.title,
        company: cleanText(companyEl?.innerText).replace(/^at\s+/i, '') || null,
        jd_text: jdText,
        warnings
      };
    };
  } else {
    // Generic fallback — works on any job page
    scraper = () => {
      const cleanText = text => (text || '').replace(/\s+/g, ' ').trim();
      const picked = cleanText(window.getSelection?.().toString());
      const jdText = cleanText(picked || document.querySelector('main, article')?.innerText || document.body.innerText).slice(0, 16000);
      return {
        url: location.href,
        title: document.title,
        company: null,
        jd_text: jdText,
        warnings: [
          'Used generic page extraction because this is not a supported LinkedIn or Greenhouse URL.',
          ...(picked ? ['Used selected text as the primary job description.'] : []),
          ...(jdText.length < 600 ? ['Extracted text is short; screenshot fallback may be needed.'] : [])
        ]
      };
    };
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scraper
  });

  const data = results?.[0]?.result;
  if (!data?.jd_text) throw new Error('Could not extract text from this page.');
  data.jd_text = cleanText(data.jd_text);
  return data;
}

function renderScrapeWarning(data) {
  if (data?.warnings?.length) {
    $('scrape-warning').textContent = data.warnings.join(' ');
    show($('scrape-warning'));
  } else {
    hide($('scrape-warning'));
  }
}

function renderResult({ run_id, skill_version, memory_used, result }) {
  currentRunId = run_id;
  const partial = result?.status === 'partial_failure';
  $('score').textContent = result.ats_score ?? '—';
  $('rec').textContent = partial
    ? `· partial failure · skill v${skill_version}`
    : result.recommendation ? `· ${result.recommendation} · skill v${skill_version}` : `· skill v${skill_version}`;
  $('summary').textContent = partial
    ? `Model output did not match the expected schema: ${(result.validation_errors || []).join('; ')}`
    : result.fit_summary || result.rationale || '';

  $('flags').replaceChildren();
  for (const flag of result.red_flags || []) {
    addPill($('flags'), flag.signal || 'flag', (flag.severity || 'low').toLowerCase());
  }
  for (const gap of (result.skills_gap || []).slice(0, 3)) {
    addPill($('flags'), `gap: ${gap}`);
  }

  $('memory-cited').textContent = memory_used?.length
    ? `Memory: ${memory_used.map(m => m.title).join(' · ')}`
    : 'Memory: (none matched)';

  $('raw').textContent = JSON.stringify(result, null, 2);
  show($('output'));
}

async function analyze() {
  hide($('error')); hide($('output')); hide($('scrape-warning'));
  $('analyze-btn').disabled = true;
  $('retry-btn').disabled = true;
  $('analyze-btn').textContent = 'Analyzing…';
  setStage('Reading the active tab…');
  try {
    const scraped = lastScraped || await scrapeActiveTab();
    lastScraped = scraped;
    renderScrapeWarning(scraped);
    if ((scraped.jd_text || '').length < 600) {
      setStage('Text scrape was thin, capturing visible screenshot fallback…');
      scraped.screenshot_data_url = await captureScreenshot();
      if (scraped.screenshot_data_url) {
        scraped.warnings = [...(scraped.warnings || []), 'Attached screenshot fallback; API needs SCREENSHOT_MODEL set to read it.'];
        renderScrapeWarning(scraped);
      }
    }
    setStage('Sending analysis request…');
    const r = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scraped)
    });
    if (!r.ok && r.status !== 206) {
      let message = await r.text();
      try {
        const parsed = JSON.parse(message);
        message = parsed.message || message;
        if (parsed.text_length != null) message += ` Extracted text length: ${parsed.text_length}.`;
        if (parsed.captured_screenshot && !parsed.screenshot_model_configured) {
          message += ' Screenshot fallback was captured, but SCREENSHOT_MODEL is not configured on the API.';
        }
      } catch {}
      throw new Error(`API ${r.status}: ${message}`);
    }
    const data = await r.json();
    currentJobId = data.job_id || null;
    renderResult(data);
    setStage('Done.');
  } catch (e) {
    $('error').textContent = `${e.message} If this is an unsupported page, open the full job description or select the JD text before retrying.`;
    show($('error'));
    show($('retry-btn'));
    setStage('Analysis stopped.');
  } finally {
    $('analyze-btn').disabled = false;
    $('retry-btn').disabled = false;
    $('analyze-btn').textContent = 'Analyze this JD';
  }
}

async function sendFeedback(thumbs) {
  if (!currentRunId) return;
  $('fb-status').textContent = 'saving…';
  try {
    await fetch(`${API}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ run_id: currentRunId, thumbs, note: $('fb-note').value.trim() || undefined })
    });
    $('fb-status').textContent = thumbs === 1 ? 'thanks!' : 'logged for reflection';
  } catch (e) {
    $('fb-status').textContent = 'error';
  }
}

async function loadTemplates() {
  try {
    const r = await fetch(`${API}/resume/templates`);
    const data = await r.json();
    const sel = $('template-select');
    sel.replaceChildren();
    for (const t of data.templates || []) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.replace('base-', '').replace('-', ' / ').toUpperCase();
      sel.appendChild(opt);
    }
  } catch {
    $('template-select').innerHTML = '<option value="">API offline</option>';
  }
}

async function generateResume() {
  const templateName = $('template-select')?.value;
  if (!currentJobId || !templateName) {
    $('resume-status').textContent = 'Analyze a job first.';
    return;
  }
  $('resume-btn').disabled = true;
  $('resume-status').textContent = 'Tailoring with 26B model…';
  try {
    const r = await fetch(`${API}/resume/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ job_id: currentJobId, template_name: templateName })
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    $('resume-status').innerHTML = `Done! <a href="${API}/resume/${data.id}/pdf" target="_blank" style="color:#111;font-weight:600;">Download PDF</a>`;
  } catch (e) {
    $('resume-status').textContent = `Error: ${e.message}`;
  } finally {
    $('resume-btn').disabled = false;
  }
}

$('analyze-btn').addEventListener('click', analyze);
$('retry-btn').addEventListener('click', () => { lastScraped = null; analyze(); });
$('up-btn').addEventListener('click', () => sendFeedback(1));
$('down-btn').addEventListener('click', () => sendFeedback(-1));
$('resume-btn').addEventListener('click', generateResume);

checkHealth();
loadTemplates();

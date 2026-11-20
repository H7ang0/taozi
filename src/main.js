const REPOSITORY_URL = 'https://h7ang0.github.io/taozi/';
const QNQ_SOURCE_URL = 'https://h7ang0.github.io/taozi/appstore';
// 上传 IPA 后填入完整地址或站内路径，例如 'ipa/ThemeDuo.ipa'。
const IPA_DOWNLOAD_URL = '';
const copyButton = document.querySelector('#copy-source');
const copyQnqButton = document.querySelector('#copy-qnq');
const toast = document.querySelector('#toast');
const systemOverride = document.querySelector('#system-override');
let toastTimer;

export function detectAppleDevice(userAgent, maxTouchPoints = 0) {
  const ua = String(userAgent || '');
  const iPadDesktopMode = /Macintosh/.test(ua) && maxTouchPoints > 1;
  const explicitlyMobile = /iPhone|iPad|iPod/.test(ua);
  if (!explicitlyMobile && !iPadDesktopMode) {
    return { isAppleMobile: false, device: '桌面或其他设备', model: '', major: null, version: null, source: 'none' };
  }

  const device = iPadDesktopMode ? 'iPad' : /iPad/.test(ua) ? 'iPad' : /iPod/.test(ua) ? 'iPod touch' : 'iPhone';
  const hardwareMatch = ua.match(/\((iPhone\d+,\d+|iPad\d+,\d+|iPod\d+,\d+);/);
  const osMatch = ua.match(/CPU (?:iPhone )?OS (\d+)(?:_(\d+))?(?:_(\d+))? like Mac OS X/);
  const safariMatch = ua.match(/Version\/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  const isSafari = /Safari\//.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android)/.test(ua);
  let major = osMatch ? Number(osMatch[1]) : null;
  let version = osMatch ? osMatch.slice(1).filter(Boolean).join('.') : null;
  let source = osMatch ? 'system' : 'unknown';

  // Safari 26+ freezes the CPU OS token, while Version/<major> continues to track releases.
  if (isSafari && safariMatch && (!major || (Number(safariMatch[1]) >= 26 && major < 26))) {
    major = Number(safariMatch[1]);
    version = `${major}.x`;
    source = 'safari';
  }

  return {
    isAppleMobile: true,
    device,
    model: hardwareMatch ? hardwareMatch[1] : device,
    major,
    version,
    source,
    safariVersion: safariMatch ? safariMatch.slice(1).filter(Boolean).join('.') : null
  };
}

const currentDevice = detectAppleDevice(navigator.userAgent, navigator.maxTouchPoints);

function renderDevice(device) {
  const summary = document.querySelector('#device-summary');
  const detail = document.querySelector('#device-detail');
  if (!device.isAppleMobile) {
    summary.textContent = '未识别到 iPhone 或 iPad';
    detail.textContent = '当前显示全部安装包，也可以手动选择系统规则。';
    return;
  }

  const osName = device.device === 'iPad' ? 'iPadOS' : 'iOS';
  summary.textContent = device.version ? `${device.model} · ${osName} ${device.version}` : `${device.model} · 系统版本未知`;
  if (device.source === 'safari') {
    detail.textContent = `Safari ${device.safariVersion} · 系统字段已冻结，已按 Safari 主版本识别。Safari 不提供具体机型。`;
  } else if (device.source === 'system') {
    detail.textContent = '已读取浏览器提供的系统信息。Safari 通常只提供设备类型，不提供具体机型。';
  } else {
    detail.textContent = '无法可靠读取系统版本，请手动选择安装包规则。';
  }
}

function automaticRule() {
  if (!currentDevice.isAppleMobile) return 'all';
  return currentDevice.major !== null && currentDevice.major >= 26 ? 'modern' : 'legacy';
}

function applyPackageRule(requestedRule = systemOverride.value) {
  const rule = requestedRule === 'auto' ? automaticRule() : requestedRule;
  document.querySelectorAll('[data-package-kind]').forEach(row => {
    const isDeb = row.dataset.packageKind === 'deb';
    row.hidden = isDeb ? rule === 'modern' : rule === 'legacy';
  });

  const visibleCount = [...document.querySelectorAll('[data-package-kind]')].filter(row => !row.hidden).length;
  document.querySelector('#package-count').textContent = `${visibleCount} ${visibleCount === 1 ? 'PACKAGE' : 'PACKAGES'}`;
  const description = document.querySelector('#package-description');
  if (rule === 'modern') {
    const prefix = requestedRule === 'auto' && currentDevice.major !== null
      ? `已识别为 ${currentDevice.device === 'iPad' ? 'iPadOS' : 'iOS'} ${currentDevice.major}.x，`
      : '已手动切换，';
    description.textContent = `${prefix}仅显示适用于 iOS 26、27 及更高版本的 IPA 安装包。`;
  } else if (rule === 'legacy') {
    description.textContent = 'iOS 18 或更早版本请根据越狱环境选择 DEB；仅按系统版本无法判断 Rootless、Rootful 或 RootHide。';
  } else {
    description.textContent = '正在显示全部安装包。DEB 按越狱环境区分，IPA 适用于 iOS 26 或更高版本。';
  }
}

renderDevice(currentDevice);
applyPackageRule('auto');
systemOverride.addEventListener('change', () => applyPackageRule(systemOverride.value));

const ipaButton = document.querySelector('#ipa-download');
if (IPA_DOWNLOAD_URL) {
  const ipaUrl = new URL(IPA_DOWNLOAD_URL, REPOSITORY_URL).href;
  ipaButton.disabled = false;
  ipaButton.querySelector('span').textContent = '下载 .IPA';
  document.querySelector('#ipa-note').textContent = '适用于 iOS 26、27 及更高版本。';
  ipaButton.addEventListener('click', () => window.location.assign(ipaUrl));
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('copy-failed');
}

copyButton.addEventListener('click', async () => {
  try {
    await copyText(REPOSITORY_URL);
    copyButton.textContent = '已复制';
    showToast('源地址已复制，可粘贴到 Sileo');
    window.setTimeout(() => { copyButton.textContent = '复制'; }, 1800);
  } catch {
    showToast('复制失败，请长按源地址手动复制');
  }
});

document.querySelector('#sileo-link').addEventListener('click', () => {
  showToast('正在打开 Sileo…');
});

copyQnqButton.addEventListener('click', async () => {
  try {
    await copyText(QNQ_SOURCE_URL);
    copyQnqButton.textContent = '已复制';
    showToast('全能签软件源地址已复制');
    window.setTimeout(() => { copyQnqButton.textContent = '复制'; }, 1800);
  } catch {
    showToast('复制失败，请长按源地址手动复制');
  }
});

document.querySelector('#qnq-link').addEventListener('click', () => {
  showToast('正在打开全能签…');
});

function displayDate(date) {
  return String(date || '').replaceAll('-', '.');
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

async function loadChangelog() {
  try {
    const response = await fetch(new URL('changelog.json', REPOSITORY_URL), { cache: 'no-cache' });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.entries) || !data.entries.length) return;

    document.querySelector('#latest-version').textContent = data.latest || data.entries[0].version;
    document.querySelector('#updated-date').textContent = displayDate(data.updated || data.entries[0].date);

    const entries = data.entries.map((entry, index) => {
      const item = makeElement('li', 'log-item');
      const heading = makeElement('div', 'log-heading');
      const version = makeElement('span', 'log-version', entry.version);
      if (index === 0) version.appendChild(makeElement('span', 'latest-marker', 'LATEST'));
      const date = makeElement('time', 'log-date', displayDate(entry.date));
      date.setAttribute('datetime', entry.date || '');
      heading.append(version, date);
      item.appendChild(heading);

      if (Array.isArray(entry.lines) && entry.lines.length) {
        const lines = makeElement('ul', 'log-lines');
        entry.lines.forEach(line => lines.appendChild(makeElement('li', '', line)));
        item.appendChild(lines);
      }
      return item;
    });
    document.querySelector('.changelog-list').replaceChildren(...entries);
  } catch {
    // The verified static release history remains visible when remote data is unavailable.
  }
}

async function loadDylib() {
  try {
    const response = await fetch(new URL('dylib/index.json', REPOSITORY_URL), { cache: 'no-cache' });
    if (!response.ok) return;
    const data = await response.json();
    const file = Array.isArray(data.files) ? data.files[0] : null;
    if (!file) return;

    document.querySelector('.file-name').textContent = file.name;
    const metadata = document.querySelector('.file-meta');
    const size = `${Math.round((file.size || 0) / 1024).toLocaleString('en-US')} KB`;
    metadata.replaceChildren(makeElement('span', '', file.path), document.createElement('br'), makeElement('span', '', size));
    const link = document.querySelector('.dylib-link');
    link.href = new URL(file.path, REPOSITORY_URL).href;
    link.setAttribute('aria-label', `下载 ${file.name}`);
  } catch {
    // The verified static download remains available when remote data is unavailable.
  }
}

loadChangelog();
loadDylib();

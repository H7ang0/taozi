const OWNER = 'H7ang0';
const REPO = 'taozi';
const BRANCH = 'main';
const API = 'https://api.github.com';
const SITE = 'https://h7ang0.github.io/taozi/';
const TOKEN_KEY = 'td_admin_token';
const CLIENT_KEY = 'td_admin_client_id';
const SCOPE = 'public_repo';

let token = sessionStorage.getItem(TOKEN_KEY) || '';
let pollTimer = 0;
let toastTimer = 0;
let changelogData = null;

const $ = (sel) => document.querySelector(sel);

function showToast(message) {
  window.clearTimeout(toastTimer);
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
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

function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function rfcDate() {
  return new Date().toUTCString().replace('GMT', '+0000');
}

function isoCn() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}+08:00`;
}

function showView(name) {
  ['login', 'device', 'denied', 'admin'].forEach(v => {
    $(`#view-${v}`).hidden = v !== name;
  });
}

function logLine(el, message) {
  el.hidden = false;
  el.textContent += `${message}\n`;
  el.scrollTop = el.scrollHeight;
}

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    let detail = '';
    try {
      const data = await response.json();
      detail = data.message || '';
    } catch { /* ignore */ }
    throw new Error(`GitHub API ${response.status}${detail ? `：${detail}` : ''}`);
  }
  return response.json();
}

async function getFileText(path) {
  const data = await api(`/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`);
  return b64ToUtf8(data.content);
}

async function getFileJson(path) {
  return JSON.parse(await getFileText(path));
}

async function commitFiles(files, message) {
  const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const headSha = ref.object.sha;
  const head = await api(`/repos/${OWNER}/${REPO}/git/commits/${headSha}`);
  const tree = [];
  for (const file of files) {
    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: file.base64 !== undefined
        ? { content: file.base64, encoding: 'base64' }
        : { content: file.text, encoding: 'utf-8' }
    });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: { base_tree: head.tree.sha, tree }
  });
  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: { message, tree: newTree.sha, parents: [headSha] }
  });
  await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: { sha: commit.sha }
  });
  return commit.sha;
}

/* ---------- 登录与设备码流程 ---------- */

async function startLogin() {
  const clientId = $('#client-id').value.trim();
  if (!clientId) {
    showToast('请先填写 OAuth App 的 Client ID');
    $('#client-id').focus();
    return;
  }
  localStorage.setItem(CLIENT_KEY, clientId);
  const btn = $('#login-btn');
  btn.disabled = true;
  try {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, scope: SCOPE })
    });
    const data = await response.json();
    if (!response.ok || !data.device_code) {
      throw new Error(data.error_description || data.error || `HTTP ${response.status}`);
    }
    $('#user-code').textContent = data.user_code;
    $('#verify-link').href = data.verification_uri || 'https://github.com/login/device';
    $('#device-status').textContent = '等待授权…';
    showView('device');
    pollForToken(clientId, data.device_code, Math.max(5, data.interval || 5));
  } catch (error) {
    showToast(`获取设备码失败：${error.message}（确认 Client ID 正确且已启用 Device Flow）`);
  } finally {
    btn.disabled = false;
  }
}

function pollForToken(clientId, deviceCode, interval) {
  window.clearTimeout(pollTimer);
  pollTimer = window.setTimeout(async () => {
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const data = await response.json();
      if (data.access_token) {
        token = data.access_token;
        sessionStorage.setItem(TOKEN_KEY, token);
        showToast('授权成功');
        await boot();
        return;
      }
      if (data.error === 'authorization_pending') {
        pollForToken(clientId, deviceCode, interval);
        return;
      }
      if (data.error === 'slow_down') {
        pollForToken(clientId, deviceCode, interval + 5);
        return;
      }
      $('#device-status').textContent = `授权失败：${data.error_description || data.error}，请重试。`;
    } catch (error) {
      $('#device-status').textContent = `网络异常：${error.message}，正在重试…`;
      pollForToken(clientId, deviceCode, interval);
    }
  }, interval * 1000);
}

function logout() {
  token = '';
  sessionStorage.removeItem(TOKEN_KEY);
  window.clearTimeout(pollTimer);
  $('#auth-status').textContent = '未登录';
  $('#logout-btn').hidden = true;
  showView('login');
}

async function boot() {
  if (!token) {
    showView('login');
    return;
  }
  try {
    const [user, repo] = await Promise.all([
      api('/user'),
      api(`/repos/${OWNER}/${REPO}`)
    ]);
    if (!repo.permissions || !repo.permissions.push) {
      $('#denied-user').textContent = `@${user.login}`;
      showView('denied');
      return;
    }
    $('#auth-status').textContent = `@${user.login} · 已授权`;
    $('#logout-btn').hidden = false;
    showView('admin');
    await Promise.all([loadChangelog(), loadSources()]);
  } catch (error) {
    if (String(error.message).includes('401')) {
      logout();
      showToast('登录已失效，请重新授权');
    } else {
      showToast(`初始化失败：${error.message}`);
    }
  }
}

/* ---------- 更新日志 ---------- */

function renderChangelog() {
  const list = $('#changelog-list');
  list.replaceChildren();
  if (!changelogData || !Array.isArray(changelogData.entries) || !changelogData.entries.length) {
    const empty = document.createElement('p');
    empty.className = 'note';
    empty.textContent = '暂无条目。';
    list.appendChild(empty);
    return;
  }
  changelogData.entries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'log-entry';
    const meta = document.createElement('div');
    meta.className = 'log-meta';
    const version = document.createElement('div');
    version.className = 'log-version';
    version.textContent = `${entry.version}${index === 0 ? ' · LATEST' : ''}`;
    const sub = document.createElement('div');
    sub.className = 'log-sub';
    const lines = Array.isArray(entry.lines) ? entry.lines.length : 0;
    sub.textContent = `${entry.date || '未填日期'} · ${lines} 条更新内容`;
    meta.append(version, sub);
    const del = document.createElement('button');
    del.className = 'btn btn-sm btn-danger';
    del.type = 'button';
    del.textContent = '删除';
    del.addEventListener('click', () => {
      changelogData.entries.splice(index, 1);
      renderChangelog();
      showToast(`已移除 ${entry.version}，保存后生效`);
    });
    row.append(meta, del);
    list.appendChild(row);
  });
}

async function loadChangelog() {
  changelogData = await getFileJson('changelog.json');
  renderChangelog();
}

function addChangelogEntry() {
  if (!changelogData) return;
  const version = $('#cl-version').value.trim();
  const date = $('#cl-date').value || today();
  if (!version) {
    showToast('请填写版本号');
    $('#cl-version').focus();
    return;
  }
  if (changelogData.entries.some(e => e.version === version)) {
    showToast('该版本号已存在');
    return;
  }
  const lines = $('#cl-lines').value.split('\n').map(s => s.trim()).filter(Boolean);
  changelogData.entries.unshift({ version, date, lines });
  $('#cl-version').value = '';
  $('#cl-lines').value = '';
  renderChangelog();
  showToast(`已添加 ${version}，保存后生效`);
}

async function saveChangelog() {
  if (!changelogData || !changelogData.entries.length) {
    showToast('列表为空，无法保存');
    return;
  }
  changelogData.latest = changelogData.entries[0].version;
  changelogData.updated = changelogData.entries[0].date || today();
  const btn = $('#cl-save');
  btn.disabled = true;
  try {
    const sha = await commitFiles(
      [{ path: 'changelog.json', text: `${JSON.stringify(changelogData, null, 2)}\n` }],
      `后台更新日志：${changelogData.latest}`
    );
    showToast(`已提交 ${sha.slice(0, 7)}，Pages 几分钟后生效`);
  } catch (error) {
    showToast(`提交失败：${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 软件源 ---------- */

async function loadSources() {
  const [qnq, lcsign] = await Promise.all([getFileJson('appstore'), getFileJson('source.json')]);
  $('#qnq-name').value = qnq.name || '';
  $('#qnq-icon').value = qnq.sourceicon || '';
  const qapp = (qnq.apps || [])[0] || {};
  $('#qnq-app-name').value = qapp.name || '';
  $('#qnq-app-version').value = qapp.version || '';
  $('#qnq-app-date').value = qapp.versionDate || '';
  $('#qnq-app-size').value = qapp.size || '';
  $('#qnq-app-url').value = qapp.downloadURL || '';
  $('#qnq-app-desc').value = qapp.versionDescription || '';
  $('#lc-name').value = lcsign.name || '';
  $('#lc-subtitle').value = lcsign.subtitle || '';
  $('#lc-desc').value = lcsign.description || '';
  const lapp = (lcsign.apps || [])[0] || {};
  $('#lc-app-name').value = lapp.name || '';
  const lver = (lapp.versions || [])[0] || {};
  $('#lc-version').value = lver.version || '';
  $('#lc-date').value = lver.date || '';
  $('#lc-size').value = lver.size ?? '';
  $('#lc-url').value = lver.downloadURL || '';
  $('#lc-version-desc').value = lver.localizedDescription || '';
  window.__qnq = qnq;
  window.__lcsign = lcsign;
}

async function saveSources() {
  const qnq = window.__qnq;
  const lcsign = window.__lcsign;
  if (!qnq || !lcsign) {
    showToast('源数据尚未读取完成');
    return;
  }
  const btn = $('#src-save');
  btn.disabled = true;
  try {
    qnq.name = $('#qnq-name').value.trim();
    qnq.sourceicon = $('#qnq-icon').value.trim();
    const qapp = qnq.apps[0];
    qapp.name = $('#qnq-app-name').value.trim();
    qapp.version = $('#qnq-app-version').value.trim();
    qapp.versionDate = $('#qnq-app-date').value.trim();
    qapp.size = $('#qnq-app-size').value.trim();
    qapp.downloadURL = $('#qnq-app-url').value.trim();
    qapp.versionDescription = $('#qnq-app-desc').value;
    lcsign.name = $('#lc-name').value.trim();
    lcsign.subtitle = $('#lc-subtitle').value.trim();
    lcsign.description = $('#lc-desc').value;
    const lapp = lcsign.apps[0];
    lapp.name = $('#lc-app-name').value.trim();
    const lver = lapp.versions[0];
    lver.version = $('#lc-version').value.trim();
    lver.date = $('#lc-date').value;
    lver.size = Number($('#lc-size').value.trim()) || 0;
    lver.downloadURL = $('#lc-url').value.trim();
    lver.localizedDescription = $('#lc-version-desc').value;
    const sha = await commitFiles(
      [
        { path: 'appstore', text: `${JSON.stringify(qnq, null, 2)}\n` },
        { path: 'source.json', text: `${JSON.stringify(lcsign, null, 2)}\n` }
      ],
      '后台更新软件源条目'
    );
    showToast(`已提交 ${sha.slice(0, 7)}，Pages 几分钟后生效`);
  } catch (error) {
    showToast(`提交失败：${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 上传文件 ---------- */

let pickedFile = null;
let pickedBuffer = null;
let pickedSha = '';

function bufferToB64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function updateUploadBoxes() {
  const name = pickedFile ? pickedFile.name.toLowerCase() : '';
  const dir = $('#up-dir').value;
  $('#up-deb-box').hidden = !(name.endsWith('.deb') || dir === 'debs/');
  $('#up-dylib-line').hidden = !(name.endsWith('.dylib') || dir === 'dylib/');
  $('#up-ipa-box').hidden = !(name.endsWith('.ipa') || dir === 'ipa/');
}

async function onFilePicked() {
  const file = $('#up-file').files[0];
  pickedFile = file || null;
  pickedBuffer = null;
  pickedSha = '';
  $('#up-save').disabled = !file;
  if (!file) {
    $('#up-info').hidden = true;
    $('#up-pick-text').textContent = '点击选择 .deb / .dylib / .ipa 文件';
    updateUploadBoxes();
    return;
  }
  $('#up-pick-text').textContent = file.name;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.deb')) $('#up-dir').value = 'debs/';
  else if (lower.endsWith('.dylib')) $('#up-dir').value = 'dylib/';
  else if (lower.endsWith('.ipa')) $('#up-dir').value = 'ipa/';
  updateUploadBoxes();
  $('#up-info').hidden = false;
  $('#up-info').textContent = '正在计算 SHA-256…';
  pickedBuffer = await file.arrayBuffer();
  pickedSha = await sha256Hex(pickedBuffer);
  $('#up-info').innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = `${file.name} · ${file.size.toLocaleString('en-US')} 字节`;
  const br = document.createElement('br');
  const hash = document.createTextNode(`SHA256: ${pickedSha}`);
  $('#up-info').append(strong, br, hash);
}

function buildPackagesStanza(filename, size, sha) {
  const lines = [
    `Package: ${$('#up-pkg').value.trim()}`,
    `Name: ${$('#up-name').value.trim()}`,
    `Description: ${$('#up-desc-deb').value.trim()}`,
    'Maintainer: 小桃子',
    'Author: 小桃子',
    'Section: Tweaks',
    'Depends: firmware (>= 15.0), mobilesubstrate (>= 0.9.5000)',
    `Architecture: ${$('#up-arch').value.trim()}`,
    `Version: ${$('#up-version').value.trim()}`,
    `Icon: ${SITE}CydiaIcon.png`,
    `Installed-Size: ${$('#up-installed-size').value.trim()}`,
    `Filename: debs/${filename}`,
    `Size: ${size}`,
    `SHA256: ${sha}`
  ];
  return lines.join('\n');
}

async function uploadAndCommit() {
  if (!pickedFile || !pickedBuffer) return;
  const btn = $('#up-save');
  const log = $('#up-log');
  btn.disabled = true;
  log.textContent = '';
  try {
    const dir = $('#up-dir').value;
    const filename = pickedFile.name;
    const path = `${dir}${filename}`;
    const lower = filename.toLowerCase();
    const files = [{ path, base64: bufferToB64(pickedBuffer) }];
    logLine(log, `已打包 ${filename}（${pickedBuffer.byteLength} 字节）`);

    if (lower.endsWith('.deb') && $('#up-deb-sync').checked) {
      const version = $('#up-version').value.trim();
      if (!version) throw new Error('请填写 DEB 版本号');
      let packagesText = await getFileText('Packages');
      if (!packagesText.endsWith('\n')) packagesText += '\n';
      packagesText += `\n${buildPackagesStanza(filename, pickedBuffer.byteLength, pickedSha)}\n`;
      files.push({ path: 'Packages', text: packagesText });
      logLine(log, 'Packages 已追加新包条目');

      const encoder = new TextEncoder();
      const pkgSha = await sha256Hex(encoder.encode(packagesText).buffer);
      const pkgSize = encoder.encode(packagesText).length;
      let releaseText = await getFileText('Release');
      releaseText = releaseText
        .replace(/Date: .*/, `Date: ${rfcDate()}`)
        .replace(/ [0-9a-f]{64} \d+ Packages/, ` ${pkgSha} ${pkgSize} Packages`);
      files.push({ path: 'Release', text: releaseText });
      logLine(log, 'Release 哈希与日期已更新');
    }

    if (lower.endsWith('.dylib') && $('#up-dylib-sync').checked) {
      const index = await getFileJson('dylib/index.json');
      index.updated = today();
      index.files = [{ name: filename, path, size: pickedBuffer.byteLength, sha256: pickedSha }];
      files.push({ path: 'dylib/index.json', text: `${JSON.stringify(index)}\n` });
      logLine(log, 'dylib/index.json 已更新');
    }

    if (lower.endsWith('.ipa') && $('#up-ipa-sync').checked) {
      const version = $('#up-ipa-version').value.trim() || '1.0';
      const url = `${SITE}${path}`;
      let mainJs = await getFileText('src/main.js');
      mainJs = mainJs.replace(
        /const IPA_DOWNLOAD_URL = '[^']*';/,
        `const IPA_DOWNLOAD_URL = '${path}';`
      );
      files.push({ path: 'src/main.js', text: mainJs });
      logLine(log, '网站 IPA 下载按钮已开启');

      const qnq = await getFileJson('appstore');
      qnq.apps = (qnq.apps || []).filter(app => app.type !== 0);
      qnq.apps.unshift({
        name: 'ThemeDuo IPA',
        type: 0,
        version,
        versionDate: isoCn(),
        versionDescription: 'ThemeDuo 未签名 IPA，适用于 iOS 26 及更高版本。',
        lock: '0',
        downloadURL: url,
        isLanZouCloud: '0',
        iconURL: `${SITE}CydiaIcon.png`,
        tintColor: '5A4A9E',
        size: String(pickedBuffer.byteLength)
      });
      files.push({ path: 'appstore', text: `${JSON.stringify(qnq, null, 2)}\n` });

      const lcsign = await getFileJson('source.json');
      lcsign.apps = (lcsign.apps || []).filter(app => app.bundleIdentifier !== 'com.xiaotaozi.themeduo.ipa');
      lcsign.apps.unshift({
        name: 'ThemeDuo IPA',
        bundleIdentifier: 'com.xiaotaozi.themeduo.ipa',
        developerName: 'ThemeDuo',
        subtitle: '抖音主题插件',
        localizedDescription: 'ThemeDuo 未签名 IPA，适用于 iOS 26 及更高版本。',
        category: '应用',
        versions: [{
          version,
          date: today(),
          localizedDescription: 'ThemeDuo 未签名 IPA，适用于 iOS 26 及更高版本。',
          downloadURL: url,
          size: pickedBuffer.byteLength,
          minOSVersion: '26.0'
        }],
        iconURL: `${SITE}CydiaIcon.png`
      });
      files.push({ path: 'source.json', text: `${JSON.stringify(lcsign, null, 2)}\n` });
      logLine(log, '全能签与 LCSign 源已写入 IPA 条目');
    }

    logLine(log, '正在提交到 GitHub…');
    const sha = await commitFiles(files, `后台上传 ${filename}`);
    logLine(log, `完成：提交 ${sha.slice(0, 7)}，Pages 约 1～5 分钟后生效。`);
    showToast('上传完成');
  } catch (error) {
    logLine(log, `失败：${error.message}`);
    showToast(`上传失败：${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 事件绑定与启动 ---------- */

$('#client-id').value = localStorage.getItem(CLIENT_KEY) || '';
$('#login-btn').addEventListener('click', startLogin);
$('#copy-code').addEventListener('click', async () => {
  try {
    await copyText($('#user-code').textContent);
    showToast('验证码已复制');
  } catch {
    showToast('复制失败，请手动选择复制');
  }
});
$('#cancel-device').addEventListener('click', () => {
  window.clearTimeout(pollTimer);
  showView('login');
});
$('#logout-btn').addEventListener('click', logout);
$('#denied-logout').addEventListener('click', logout);
$('#cl-date').value = today();

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.setAttribute('aria-selected', String(b === btn)));
    ['changelog', 'sources', 'upload'].forEach(name => {
      $(`#tab-${name}`).hidden = name !== btn.dataset.tab;
    });
  });
});

$('#cl-add').addEventListener('click', addChangelogEntry);
$('#cl-save').addEventListener('click', saveChangelog);
$('#src-save').addEventListener('click', saveSources);
$('#src-reload').addEventListener('click', async () => {
  try {
    await loadSources();
    showToast('已重新读取');
  } catch (error) {
    showToast(`读取失败：${error.message}`);
  }
});
$('#up-file').addEventListener('change', onFilePicked);
$('#up-dir').addEventListener('change', updateUploadBoxes);
$('#up-save').addEventListener('click', uploadAndCommit);
updateUploadBoxes();

boot();

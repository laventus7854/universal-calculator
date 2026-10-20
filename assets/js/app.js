/* Калькулятор всего — интерфейс */
(function () {
  'use strict';

  var E = window.CalcEngine;
  if (!E) return;

  var APP_VERSION = '1.0.0';
  var REPO_URL = 'https://github.com/laventus7854/universal-calculator';

  var $ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };
  var $$ = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };

  var STORAGE = {
    theme: 'calc-theme',
    history: 'calc-history',
    angle: 'calc-angle'
  };

  var TAB_TITLES = {
    scientific: 'Научный калькулятор',
    percent: 'Проценты',
    finance: 'Кредит и вклад',
    units: 'Конвертер единиц',
    health: 'ИМТ и калории',
    dates: 'Калькулятор дат'
  };

  var state = {
    angle: 'deg',
    history: [],
    fin: 'credit',
    sex: 'male',
    currency: 'RUB',
    tab: 'scientific',
    lastSciValue: null,
    creditResult: null,
    depositResult: null,
    unitCategory: 'length',
    unitFrom: 'm',
    unitTo: 'km'
  };

  /* ------------------------------------------------------------------ *
   *  Утилиты
   * ------------------------------------------------------------------ */

  function storageGet(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      /* приватный режим — просто работаем без сохранения */
    }
  }

  function parseInput(element) {
    return E.parseNumeric(element ? element.value : '');
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function showToast(message) {
    var toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 1800);
  }

  function copyText(text) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.top = '-1000px';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
        showToast('Скопировано');
      } catch (err) {
        showToast('Не удалось скопировать');
      }
      area.remove();
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('Скопировано');
      }).catch(fallback);
    } else {
      fallback();
    }
  }

  function plural(number, forms) {
    var abs = Math.abs(number) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  function monthsLabel(months) {
    if (months % 12 === 0) {
      var years = months / 12;
      return years + ' ' + plural(years, ['год', 'года', 'лет']);
    }
    return months + ' мес.';
  }

  function signed(value, digits) {
    var formatted = E.formatNumber(value, digits == null ? 2 : digits);
    return value > 0 ? '+' + formatted : formatted;
  }

  function money(value) {
    return E.formatMoney(value, state.currency);
  }

  function todayISO() {
    var date = new Date();
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function toISO(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function formatCompact(value) {
    try {
      return new Intl.NumberFormat('ru-RU', {
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(value);
    } catch (err) {
      return E.formatNumber(value, 0);
    }
  }

  function setError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-error');
  }

  function clearError(element) {
    if (!element) return;
    element.classList.remove('is-error');
  }

  /* ------------------------------------------------------------------ *
   *  Тема, вкладки, ссылки
   * ------------------------------------------------------------------ */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    storageSet(STORAGE.theme, theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#eef2f9' : '#070b16');
    var toggle = $('#theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-label', theme === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему');
    }
    drawActiveChart();
  }

  function initChrome() {
    setText($('#app-version'), 'v' + APP_VERSION);
    setText($('#year'), String(new Date().getFullYear()));

    if (REPO_URL) {
      ['#repo-link', '#footer-repo'].forEach(function (selector) {
        var link = $(selector);
        if (link) link.href = REPO_URL;
      });
    } else {
      var repoLink = $('#repo-link');
      var footerRepo = $('#footer-repo');
      if (repoLink) repoLink.hidden = true;
      if (footerRepo) {
        footerRepo.hidden = true;
        if (footerRepo.previousElementSibling) footerRepo.previousElementSibling.hidden = true;
      }
    }

    var themeToggle = $('#theme-toggle');
    if (themeToggle) {
      applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
      themeToggle.addEventListener('click', function () {
        var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(next);
      });
    }

    $$('.segmented .seg-btn').forEach(function (button) {
      button.setAttribute('aria-pressed', button.classList.contains('is-active') ? 'true' : 'false');
    });
  }

  function tabFromHash() {
    var name = (location.hash || '').replace('#', '');
    return TAB_TITLES[name] ? name : null;
  }

  function activateTab(name, options) {
    var opts = options || {};
    if (!TAB_TITLES[name]) name = 'scientific';
    state.tab = name;

    $$('.tab').forEach(function (tab) {
      var active = tab.dataset.panel === name;
      tab.classList.toggle('is-active', active);
      if (active) {
        tab.setAttribute('aria-current', 'page');
      } else {
        tab.removeAttribute('aria-current');
      }
    });

    $$('.panel').forEach(function (panel) {
      var active = panel.id === 'panel-' + name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });

    document.title = name === 'scientific'
      ? 'Калькулятор всего — онлайн-калькуляторы в одном месте'
      : TAB_TITLES[name] + ' — Калькулятор всего';

    if (opts.push !== false) {
      try {
        history.pushState({ panel: name }, '', '#' + name);
      } catch (err) {
        location.hash = name;
      }
    }

    if (name === 'finance') {
      window.requestAnimationFrame(drawActiveChart);
    }

    if (opts.scroll !== false && window.scrollY > 140) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function initTabs() {
    var initial = tabFromHash() || 'scientific';
    activateTab(initial, { push: false, scroll: false });
    try {
      history.replaceState({ panel: initial }, '', '#' + initial);
    } catch (err) {
      /* ignore */
    }

    $$('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (tab.dataset.panel !== state.tab) {
          activateTab(tab.dataset.panel);
        }
      });
    });

    window.addEventListener('popstate', function () {
      var name = tabFromHash();
      if (name) activateTab(name, { push: false, scroll: false });
    });

    window.addEventListener('hashchange', function () {
      var name = tabFromHash();
      if (name && name !== state.tab) activateTab(name, { push: false, scroll: false });
    });

    var brand = $('.brand');
    if (brand) {
      brand.addEventListener('click', function (event) {
        event.preventDefault();
        if (state.tab === 'scientific') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          activateTab('scientific');
        }
      });
    }
  }

  /* ------------------------------------------------------------------ *
   *  Научный калькулятор
   * ------------------------------------------------------------------ */

  var sciExpression;
  var sciResult;
  var sciPreview;

  function evaluateScientific() {
    var expression = sciExpression.value.trim();
    if (!expression) return { ok: false, empty: true };
    try {
      return { ok: true, value: E.evaluate(expression, { angleMode: state.angle }) };
    } catch (err) {
      return { ok: false, error: err.message || 'Ошибка в выражении' };
    }
  }

  function updateSciPreview() {
    if (!sciExpression || !sciPreview) return;
    var expression = sciExpression.value.trim();
    if (!expression) {
      sciPreview.textContent = '';
      clearError(sciPreview);
      return;
    }
    var outcome = evaluateScientific();
    if (outcome.ok) {
      sciPreview.textContent = '= ' + E.formatNumber(outcome.value, 10);
      clearError(sciPreview);
    } else {
      sciPreview.textContent = '';
      clearError(sciPreview);
    }
  }

  function calculateScientific(record) {
    var expression = sciExpression.value.trim();
    if (!expression) {
      sciResult.textContent = '0';
      state.lastSciValue = null;
      return;
    }
    var outcome = evaluateScientific();
    if (!outcome.ok) {
      sciResult.textContent = '—';
      if (sciPreview) {
        sciPreview.textContent = outcome.error || 'Ошибка в выражении';
        sciPreview.classList.add('is-error');
      }
      state.lastSciValue = null;
      return;
    }
    var formatted = E.formatNumber(outcome.value, 10);
    sciResult.textContent = formatted;
    state.lastSciValue = outcome.value;
    if (sciPreview) {
      sciPreview.textContent = '= ' + formatted;
      clearError(sciPreview);
    }
    if (record) addHistory(expression, formatted, outcome.value);
  }

  function addHistory(expression, formatted, value) {
    var entry = {
      expression: expression,
      formatted: formatted,
      value: value,
      angle: state.angle,
      time: Date.now()
    };
    var last = state.history[0];
    if (last && last.expression === currentExpressionSafe()) {
      state.history.shift();
    }
    state.history.unshift(entry);
    state.history = state.history.slice(0, 30);
    storageSet(STORAGE.history, JSON.stringify(state.history));
    renderHistory();
  }

  function currentExpressionSafe() {
    return sciExpression ? sciExpression.value.trim() : '';
  }

  var canFocusKeyboard = !window.matchMedia || window.matchMedia('(pointer: fine)').matches;

  function focusScientific() {
    if (sciExpression && canFocusKeyboard) sciExpression.focus({ preventScroll: true });
  }

  function renderHistory() {
    var list = $('#sci-history');
    var empty = $('#sci-history-empty');
    if (!list || !empty) return;
    list.textContent = '';
    empty.hidden = state.history.length > 0;
    list.hidden = state.history.length === 0;
    state.history.forEach(function (entry) {
      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';
      button.title = entry.expression + ' = ' + entry.formatted;

      var expression = document.createElement('span');
      expression.className = 'history-expression';
      expression.textContent = entry.expression;

      var value = document.createElement('span');
      value.className = 'history-value';
      value.textContent = '= ' + entry.formatted;

      button.appendChild(expression);
      button.appendChild(value);
      button.addEventListener('click', function () {
        sciExpression.value = entry.expression;
        state.angle = entry.angle === 'rad' ? 'rad' : 'deg';
        updateAngleButtons();
        calculateScientific(false);
        focusScientific();
      });
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  function updateAngleButtons() {
    $$('#sci-angle .seg-btn').forEach(function (button) {
      var active = button.dataset.angle === state.angle;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function insertAtCursor(text) {
    var start = sciExpression.selectionStart == null ? sciExpression.value.length : sciExpression.selectionStart;
    var end = sciExpression.selectionEnd == null ? start : sciExpression.selectionEnd;
    var value = sciExpression.value;

    if (text === '.' && /\.\d*$/.test(value.slice(0, start))) {
      return;
    }
    sciExpression.value = value.slice(0, start) + text + value.slice(end);
    var position = start + text.length;
    sciExpression.setSelectionRange(position, position);
    focusScientific();
    updateSciPreview();
  }

  function backspace() {
    var start = sciExpression.selectionStart;
    var end = sciExpression.selectionEnd;
    var value = sciExpression.value;
    if (start == null) {
      sciExpression.value = value.slice(0, -1);
    } else if (start === end) {
      if (start === 0) return;
      sciExpression.value = value.slice(0, start - 1) + value.slice(end);
      sciExpression.setSelectionRange(start - 1, start - 1);
    } else {
      sciExpression.value = value.slice(0, start) + value.slice(end);
      sciExpression.setSelectionRange(start, start);
    }
    focusScientific();
    updateSciPreview();
  }

  function clearScientific() {
    sciExpression.value = '';
    sciResult.textContent = '0';
    sciPreview.textContent = '';
    clearError(sciPreview);
    state.lastSciValue = null;
    focusScientific();
  }

  function initScientific() {
    sciExpression = $('#sci-expression');
    sciResult = $('#sci-result');
    sciPreview = $('#sci-preview');
    if (!sciExpression) return;

    state.angle = storageGet(STORAGE.angle, 'deg') === 'rad' ? 'rad' : 'deg';
    updateAngleButtons();

    var stored = storageGet(STORAGE.history, '[]');
    try {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        state.history = parsed.filter(function (entry) {
          return entry && typeof entry.expression === 'string' && typeof entry.formatted === 'string';
        }).slice(0, 30);
      }
    } catch (err) {
      state.history = [];
    }
    renderHistory();

    sciExpression.addEventListener('input', updateSciPreview);
    sciExpression.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        calculateScientific(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clearScientific();
      }
    });

    $$('#sci-angle .seg-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        state.angle = button.dataset.angle === 'rad' ? 'rad' : 'deg';
        storageSet(STORAGE.angle, state.angle);
        updateAngleButtons();
        updateSciPreview();
        focusScientific();
      });
    });

    $$('.keypad .key').forEach(function (button) {
      button.addEventListener('mousedown', function (event) {
        event.preventDefault();
      });
      button.addEventListener('click', function () {
        var action = button.dataset.action;
        if (action === 'clear') {
          clearScientific();
          return;
        }
        if (action === 'backspace') {
          backspace();
          return;
        }
        if (action === 'equals') {
          calculateScientific(true);
          focusScientific();
          return;
        }
        var key = button.dataset.key;
        if (key != null) insertAtCursor(key);
      });
    });

    var clearHistory = $('#sci-history-clear');
    if (clearHistory) {
      clearHistory.addEventListener('click', function () {
        state.history = [];
        storageSet(STORAGE.history, '[]');
        renderHistory();
        showToast('История очищена');
      });
    }

    $$('[data-copy-target]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.dataset.copyTarget;
        var target = document.getElementById(id);
        if (!target) return;
        var text = target.textContent.trim();
        if (id === 'sci-result' && state.lastSciValue != null) {
          text = String(state.lastSciValue);
        }
        if (text && text !== '—') copyText(text);
      });
    });

    focusScientific();
  }

  /* ------------------------------------------------------------------ *
   *  Проценты
   * ------------------------------------------------------------------ */

  function initPercent() {
    var p1x = $('#p1x');
    var p1y = $('#p1y');
    var p2x = $('#p2x');
    var p2y = $('#p2y');
    var p3base = $('#p3base');
    var p3percent = $('#p3percent');
    var p4from = $('#p4from');
    var p4to = $('#p4to');

    function recalc() {
      var x = parseInput(p1x);
      var y = parseInput(p1y);
      setText($('#p1-result'), Number.isFinite(x * y) ? E.formatNumber((x * y) / 100, 4) : '—');

      var a = parseInput(p2x);
      var b = parseInput(p2y);
      setText($('#p2-result'), Number.isFinite(a) && Number.isFinite(b) && b !== 0
        ? E.formatNumber((a / b) * 100, 3) + '%'
        : '—');

      var base = parseInput(p3base);
      var percent = parseInput(p3percent);
      setText($('#p3-plus'), Number.isFinite(base) && Number.isFinite(percent)
        ? E.formatNumber(base * (1 + percent / 100), 4)
        : '—');
      setText($('#p3-minus'), Number.isFinite(base) && Number.isFinite(percent)
        ? E.formatNumber(base * (1 - percent / 100), 4)
        : '—');

      var from = parseInput(p4from);
      var to = parseInput(p4to);
      if (Number.isFinite(from) && Number.isFinite(to) && from !== 0) {
        var change = ((to - from) / from) * 100;
        setText($('#p4-result'), signed(change, 3) + '%');
        var diff = to - from;
        setText($('#p4-diff'), 'Разница: ' + (diff > 0 ? '+' : '') + E.formatNumber(diff, 4));
      } else {
        setText($('#p4-result'), '—');
        setText($('#p4-diff'), 'Разница: —');
      }
    }

    [p1x, p1y, p2x, p2y, p3base, p3percent, p4from, p4to].forEach(function (input) {
      if (input) input.addEventListener('input', recalc);
    });
    recalc();
  }

  /* ------------------------------------------------------------------ *
   *  Графики
   * ------------------------------------------------------------------ */

  function accentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5eead4';
  }

  function mutedColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#95a3bf';
  }

  function borderColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || 'rgba(148,163,184,0.16)';
  }

  function hexToRgba(color, alpha) {
    var hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(function (c) { return c + c; }).join('');
    }
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return color;
    var num = parseInt(hex, 16);
    return 'rgba(' + ((num >> 16) & 255) + ',' + ((num >> 8) & 255) + ',' + (num & 255) + ',' + alpha + ')';
  }

  function drawChart(canvas, values, options) {
    if (!canvas) return;
    var opts = options || {};
    var rect = canvas.getBoundingClientRect();
    var width = Math.max(1, Math.round(rect.width));
    var height = 210;

    if (rect.width < 10) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var accent = accentColor();
    var muted = mutedColor();
    var border = borderColor();

    if (!values || values.length < 2) {
      ctx.fillStyle = muted;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Нет данных для графика', width / 2, height / 2);
      return;
    }

    var pad = { left: 50, right: 14, top: 16, bottom: 20 };
    var chartWidth = width - pad.left - pad.right;
    var chartHeight = height - pad.top - pad.bottom;
    var max = Math.max.apply(null, values);
    if (!(max > 0)) max = 1;
    max *= 1.05;

    ctx.lineWidth = 1;
    ctx.strokeStyle = border;
    ctx.fillStyle = muted;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (var i = 0; i <= 3; i += 1) {
      var y = pad.top + (chartHeight * i) / 3;
      var tick = max * (1 - i / 3);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(formatCompact(tick), pad.left - 8, y);
    }

    function pointAt(index) {
      var x = pad.left + (chartWidth * index) / (values.length - 1);
      var value = Math.max(0, values[index]);
      var y = pad.top + chartHeight - (value / max) * chartHeight;
      return { x: x, y: y };
    }

    var gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartHeight);
    gradient.addColorStop(0, hexToRgba(accent, 0.32));
    gradient.addColorStop(1, hexToRgba(accent, 0.01));

    ctx.beginPath();
    var first = pointAt(0);
    ctx.moveTo(first.x, pad.top + chartHeight);
    ctx.lineTo(first.x, first.y);
    for (var p = 1; p < values.length; p += 1) {
      var point = pointAt(p);
      ctx.lineTo(point.x, point.y);
    }
    var last = pointAt(values.length - 1);
    ctx.lineTo(last.x, pad.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (var q = 1; q < values.length; q += 1) {
      var linePoint = pointAt(q);
      ctx.lineTo(linePoint.x, linePoint.y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(last.x, last.y, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();

    if (opts.label) {
      ctx.fillStyle = muted;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(opts.label, width - pad.right, pad.top + 2);
    }
  }

  function drawActiveChart() {
    if (state.tab !== 'finance') return;
    if (state.fin === 'credit') {
      if (state.creditResult) {
        var creditSeries = [state.creditResult.amount];
        state.creditResult.schedule.forEach(function (row) {
          creditSeries.push(row.balance);
        });
        drawChart($('#cr-chart'), creditSeries, { label: 'Остаток долга' });
      } else {
        drawChart($('#cr-chart'), [], {});
      }
    } else if (state.depositResult) {
      var depositSeries = [state.depositResult.amount];
      state.depositResult.schedule.forEach(function (row) {
        depositSeries.push(row.balance);
      });
      drawChart($('#dp-chart'), depositSeries, { label: 'Сумма вклада' });
    } else {
      drawChart($('#dp-chart'), [], {});
    }
  }

  /* ------------------------------------------------------------------ *
   *  Финансы
   * ------------------------------------------------------------------ */

  function creditMonths() {
    var term = parseInput($('#cr-term'));
    var unit = $('#cr-term-unit').value;
    if (!Number.isFinite(term)) return NaN;
    return Math.round(unit === 'years' ? term * 12 : term);
  }

  function fillSchedule(tbody, schedule) {
    if (!tbody) return;
    tbody.textContent = '';
    var fragment = document.createDocumentFragment();
    schedule.forEach(function (row) {
      var tr = document.createElement('tr');
      var values = [
        String(row.month),
        E.formatNumber(row.payment, 0),
        E.formatNumber(row.principal, 0),
        E.formatNumber(row.interest, 0),
        E.formatNumber(Math.max(0, row.balance), 0)
      ];
      values.forEach(function (value) {
        var td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }

  function resetCreditResult(message) {
    setText($('#cr-monthly'), '—');
    setText($('#cr-monthly-label'), 'Платёж в месяц');
    setError($('#cr-monthly-sub'), message);
    ['#cr-overpay', '#cr-total', '#cr-months', '#cr-month-rate'].forEach(function (selector) {
      setText($(selector), '—');
    });
    fillSchedule($('#cr-schedule'), []);
    state.creditResult = null;
    drawActiveChart();
  }

  function recalcCredit() {
    var amount = parseInput($('#cr-amount'));
    var rate = parseInput($('#cr-rate'));
    var months = creditMonths();
    var type = $('#cr-type').value;

    try {
      var result = E.creditCalculation({
        amount: amount,
        annualRate: rate,
        months: months,
        type: type
      });
      result.amount = amount;
      state.creditResult = result;

      if (type === 'annuity') {
        setText($('#cr-monthly-label'), 'Платёж в месяц');
        setText($('#cr-monthly'), money(result.monthly));
        setText($('#cr-monthly-sub'), 'Аннуитет · ' + monthsLabel(months));
        clearError($('#cr-monthly-sub'));
      } else {
        setText($('#cr-monthly-label'), 'Первый платёж');
        setText($('#cr-monthly'), money(result.firstPayment));
        setText($('#cr-monthly-sub'), 'Последний платёж: ' + money(result.lastPayment));
        clearError($('#cr-monthly-sub'));
      }

      setText($('#cr-overpay'), money(result.overpayment));
      setText($('#cr-total'), money(result.total));
      setText($('#cr-months'), monthsLabel(months));
      setText($('#cr-month-rate'), E.formatNumber(rate / 12, 3) + '%');
      fillSchedule($('#cr-schedule'), result.schedule);
      drawActiveChart();
    } catch (err) {
      resetCreditResult(err.message || 'Проверьте параметры');
    }
  }

  function resetDepositResult(message) {
    setText($('#dp-total'), '—');
    setError($('#dp-profit-sub'), message);
    ['#dp-profit', '#dp-interest', '#dp-tax-out', '#dp-invested'].forEach(function (selector) {
      setText($(selector), '—');
    });
    setText($('#dp-yield'), 'Доходность за срок: —');
    state.depositResult = null;
    drawActiveChart();
  }

  function recalcDeposit() {
    var taxOn = $('#dp-tax-on').checked;
    var taxRate = taxOn ? parseInput($('#dp-tax')) : 0;
    var months = parseInput($('#dp-term'));
    var amount = parseInput($('#dp-amount'));

    try {
      var result = E.depositCalculation({
        amount: amount,
        annualRate: parseInput($('#dp-rate')),
        months: months,
        capitalization: $('#dp-cap').value,
        monthlyAdd: parseInput($('#dp-add')),
        taxRate: taxRate
      });
      result.amount = amount;
      state.depositResult = result;

      setText($('#dp-total'), money(result.net));
      setText($('#dp-profit-sub'), 'Доход ' + signed(result.yieldPercent, 2) + '% за ' + monthsLabel(Math.round(months)));
      clearError($('#dp-profit-sub'));
      setText($('#dp-profit'), money(result.profit));
      setText($('#dp-interest'), money(result.interest));
      setText($('#dp-tax-out'), taxOn ? money(result.tax) : '—');
      setText($('#dp-invested'), money(result.invested));
      setText($('#dp-yield'), 'Доходность за срок: ' + signed(result.yieldPercent, 2) + '%' +
        (taxOn ? ' после налога' : '') + ' · вложено ' + money(result.invested));
      drawActiveChart();
    } catch (err) {
      resetDepositResult(err.message || 'Проверьте параметры');
    }
  }

  function updateCurrency() {
    recalcCredit();
    recalcDeposit();
  }

  function initFinance() {
    var currency = $('#fin-currency');
    if (currency) {
      currency.addEventListener('change', function () {
        state.currency = currency.value;
        updateCurrency();
      });
    }

    $$('#fin-kind .seg-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        state.fin = button.dataset.fin === 'deposit' ? 'deposit' : 'credit';
        $$('#fin-kind .seg-btn').forEach(function (other) {
          var active = other === button;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-pressed', String(active));
        });
        $('#fin-credit').hidden = state.fin !== 'credit';
        $('#fin-deposit').hidden = state.fin !== 'deposit';
        window.requestAnimationFrame(drawActiveChart);
      });
    });

    ['#cr-amount', '#cr-rate', '#cr-term', '#cr-type', '#cr-term-unit'].forEach(function (selector) {
      var element = $(selector);
      if (element) {
        element.addEventListener('input', recalcCredit);
        element.addEventListener('change', recalcCredit);
      }
    });

    ['#dp-amount', '#dp-rate', '#dp-term', '#dp-cap', '#dp-add', '#dp-tax'].forEach(function (selector) {
      var element = $(selector);
      if (element) {
        element.addEventListener('input', recalcDeposit);
        element.addEventListener('change', recalcDeposit);
      }
    });

    var taxOn = $('#dp-tax-on');
    var taxInput = $('#dp-tax');
    if (taxOn && taxInput) {
      taxOn.addEventListener('change', function () {
        taxInput.disabled = !taxOn.checked;
        recalcDeposit();
      });
      taxInput.disabled = !taxOn.checked;
    }

    recalcCredit();
    recalcDeposit();
  }

  /* ------------------------------------------------------------------ *
   *  Единицы
   * ------------------------------------------------------------------ */

  var UNIT_DEFAULTS = {
    length: ['m', 'km'],
    mass: ['kg', 'lb'],
    area: ['m2', 'ft2'],
    volume: ['l', 'galus'],
    speed: ['kmh', 'ms'],
    temperature: ['c', 'f'],
    time: ['h', 'min'],
    data: ['gb', 'mb'],
    pressure: ['bar', 'psi'],
    energy: ['kcal', 'kj'],
    power: ['kw', 'hpmetric'],
    angle: ['deg', 'rad']
  };

  function unitCategory() {
    return E.unitCategories.filter(function (category) {
      return category.id === state.unitCategory;
    })[0];
  }

  function findUnit(category, id) {
    return category.units.filter(function (unit) {
      return unit.id === id;
    })[0];
  }

  function fillUnitSelect(select, category, selected) {
    if (!select) return;
    select.textContent = '';
    category.units.forEach(function (unit) {
      var option = document.createElement('option');
      option.value = unit.id;
      option.textContent = unit.name + ' (' + unit.short + ')';
      select.appendChild(option);
    });
    if (findUnit(category, selected)) {
      select.value = selected;
    } else {
      select.value = category.units[0].id;
    }
  }

  function updateUnitNote(from, to) {
    var note = $('#unit-note');
    if (!note) return;
    if (state.unitCategory === 'temperature') {
      note.textContent = '°F = °C × 9/5 + 32 · K = °C + 273,15';
      return;
    }
    try {
      var one = E.convertUnit(state.unitCategory, from.id, to.id, 1);
      note.textContent = '1 ' + from.short + ' = ' + E.formatNumber(one, 8) + ' ' + to.short;
    } catch (err) {
      note.textContent = '';
    }
  }

  function renderUnitBoard() {
    var category = unitCategory();
    var list = $('#unit-grid');
    var input = $('#unit-value');
    var from = $('#unit-from');
    var value = parseInput(input);
    if (!category || !list || !from) return;

    var fromUnit = findUnit(category, from.value) || category.units[0];
    var boardValue = $('#unit-board-value');
    if (boardValue) {
      boardValue.textContent = Number.isFinite(value)
        ? E.formatNumber(value, 6) + ' ' + fromUnit.short
        : '—';
    }

    list.textContent = '';
    category.units.forEach(function (unit) {
      var converted = null;
      if (Number.isFinite(value)) {
        try {
          converted = E.convertUnit(state.unitCategory, fromUnit.id, unit.id, value);
        } catch (err) {
          converted = null;
        }
      }
      var formatted = converted == null ? '—' : E.formatNumber(converted, 6) + ' ' + unit.short;

      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-row';
      button.title = 'Скопировать значение';

      var name = document.createElement('span');
      name.className = 'unit-name';
      name.textContent = unit.name;

      var amount = document.createElement('span');
      amount.className = 'unit-value';
      amount.textContent = formatted;

      button.appendChild(name);
      button.appendChild(amount);
      button.addEventListener('click', function () {
        if (converted == null) return;
        copyText(E.formatNumber(converted, 8) + ' ' + unit.short);
      });
      li.appendChild(button);
      list.appendChild(li);
    });
  }

  function recalcUnits() {
    var category = unitCategory();
    var input = $('#unit-value');
    var fromSelect = $('#unit-from');
    var toSelect = $('#unit-to');
    if (!category || !input || !fromSelect || !toSelect) return;

    var from = findUnit(category, fromSelect.value) || category.units[0];
    var to = findUnit(category, toSelect.value) || category.units[1] || category.units[0];
    var value = parseInput(input);
    var output = $('#unit-result');

    if (Number.isFinite(value)) {
      try {
        var result = E.convertUnit(state.unitCategory, from.id, to.id, value);
        setText(output, E.formatNumber(result, 8));
      } catch (err) {
        setText(output, '—');
      }
    } else {
      setText(output, '—');
    }

    updateUnitNote(from, to);
    renderUnitBoard();
  }

  function initUnits() {
    var categorySelect = $('#unit-category');
    var fromSelect = $('#unit-from');
    var toSelect = $('#unit-to');
    var valueInput = $('#unit-value');
    var swap = $('#unit-swap');
    if (!categorySelect || !fromSelect || !toSelect || !valueInput) return;

    E.unitCategories.forEach(function (category) {
      var option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    function loadCategory(id) {
      var category = E.unitCategories.filter(function (item) { return item.id === id; })[0] || E.unitCategories[0];
      state.unitCategory = category.id;
      var defaults = UNIT_DEFAULTS[category.id] || [category.units[0].id, category.units[1] ? category.units[1].id : category.units[0].id];
      state.unitFrom = defaults[0];
      state.unitTo = defaults[1];
      categorySelect.value = category.id;
      fillUnitSelect(fromSelect, category, state.unitFrom);
      fillUnitSelect(toSelect, category, state.unitTo);
      state.unitFrom = fromSelect.value;
      state.unitTo = toSelect.value;
      recalcUnits();
    }

    categorySelect.addEventListener('change', function () {
      loadCategory(categorySelect.value);
    });

    fromSelect.addEventListener('change', function () {
      state.unitFrom = fromSelect.value;
      recalcUnits();
    });

    toSelect.addEventListener('change', function () {
      state.unitTo = toSelect.value;
      recalcUnits();
    });

    valueInput.addEventListener('input', recalcUnits);

    if (swap) {
      swap.addEventListener('click', function () {
        var from = fromSelect.value;
        fromSelect.value = toSelect.value;
        toSelect.value = from;
        state.unitFrom = fromSelect.value;
        state.unitTo = toSelect.value;
        recalcUnits();
      });
    }

    loadCategory('length');
  }

  /* ------------------------------------------------------------------ *
   *  Здоровье
   * ------------------------------------------------------------------ */

  function initHealth() {
    var height = $('#bmi-height');
    var weight = $('#bmi-weight');

    function recalcBmi() {
      try {
        var result = E.bmiCalculation(parseInput(weight), parseInput(height));
        setText($('#bmi-value'), E.formatNumber(result.bmi, 1));
        var category = $('#bmi-category');
        if (category) {
          category.textContent = result.category;
          category.className = 'pill ' + result.tone;
        }
        setText($('#bmi-range'), 'Здоровый вес для этого роста: ' +
          E.formatNumber(result.healthyMin, 1) + '–' + E.formatNumber(result.healthyMax, 1) + ' кг');
        var marker = $('#bmi-marker');
        if (marker) marker.style.left = result.position + '%';
      } catch (err) {
        setText($('#bmi-value'), '—');
        var pill = $('#bmi-category');
        if (pill) {
          pill.textContent = '—';
          pill.className = 'pill';
        }
        setText($('#bmi-range'), err.message);
      }
    }

    if (height) height.addEventListener('input', recalcBmi);
    if (weight) weight.addEventListener('input', recalcBmi);

    var activity = $('#cal-activity');
    if (activity) {
      E.activityLevels.forEach(function (level) {
        var option = document.createElement('option');
        option.value = String(level.factor);
        option.textContent = level.name;
        activity.appendChild(option);
      });
      activity.value = '1.375';
    }

    $$('#cal-sex .seg-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        state.sex = button.dataset.sex === 'female' ? 'female' : 'male';
        $$('#cal-sex .seg-btn').forEach(function (other) {
          var active = other === button;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-pressed', String(active));
        });
        recalcCalories();
      });
    });

    var calorieInputs = ['#cal-age', '#cal-height', '#cal-weight', '#cal-activity'];
    calorieInputs.forEach(function (selector) {
      var element = $(selector);
      if (element) {
        element.addEventListener('input', recalcCalories);
        element.addEventListener('change', recalcCalories);
      }
    });

    function recalcCalories() {
      var goals = $('#cal-goals');
      var macros = $('#cal-macros');
      try {
        var result = E.calorieCalculation({
          sex: state.sex,
          age: parseInput($('#cal-age')),
          height: parseInput($('#cal-height')),
          weight: parseInput($('#cal-weight')),
          activity: $('#cal-activity').value
        });
        setText($('#cal-bmr'), Math.round(result.bmr) + ' ккал');
        setText($('#cal-tdee'), Math.round(result.tdee) + ' ккал');

        if (goals) {
          goals.textContent = '';
          result.goals.forEach(function (goal) {
            var li = document.createElement('li');
            var label = document.createElement('span');
            label.textContent = goal.label;
            var value = document.createElement('strong');
            value.textContent = Math.round(goal.kcal) + ' ккал';
            li.appendChild(label);
            li.appendChild(value);
            goals.appendChild(li);
          });
        }

        if (macros) {
          macros.textContent = '';
          [
            ['Белки', result.macros.protein],
            ['Жиры', result.macros.fat],
            ['Углеводы', result.macros.carbs]
          ].forEach(function (pair) {
            var span = document.createElement('span');
            span.textContent = pair[0] + ' ';
            var strong = document.createElement('strong');
            strong.textContent = Math.round(pair[1]) + ' г';
            span.appendChild(strong);
            macros.appendChild(span);
          });
        }

        setText($('#cal-water'), 'Вода: примерно ' + Math.round(result.water) + ' мл в день');
      } catch (err) {
        setText($('#cal-bmr'), '—');
        setText($('#cal-tdee'), '—');
        setText($('#cal-water'), err.message);
        if (goals) goals.textContent = '';
        if (macros) macros.textContent = '';
      }
    }

    recalcBmi();
    recalcCalories();
  }

  /* ------------------------------------------------------------------ *
   *  Даты
   * ------------------------------------------------------------------ */

  function initDates() {
    var dateA = $('#date-a');
    var dateB = $('#date-b');
    var dateBase = $('#date-base');
    var dateDays = $('#date-days');
    var dateBirth = $('#date-birth');
    if (!dateA || !dateB) return;

    var today = todayISO();
    var todayDate = new Date();
    dateA.value = today;
    dateB.value = E.addDaysToDate(today, 30).iso;
    dateBase.value = today;
    dateBirth.value = toISO(new Date(todayDate.getFullYear() - 30, todayDate.getMonth(), todayDate.getDate()));

    function recalcDiff() {
      try {
        var result = E.dateDifference(dateA.value, dateB.value);
        setText($('#date-diff-days'), String(result.totalDays));
        setText($('#date-diff-detail'), result.years + ' г. ' + result.months + ' мес. ' + result.days + ' дн.');
        setText($('#date-diff-weeks'), result.weeks + ' нед. ' + result.remainderDays + ' дн.');
        setText($('#date-diff-workdays'), String(result.workdays));
        setText($('#date-diff-weekends'), String(result.weekendDays));
      } catch (err) {
        ['#date-diff-days', '#date-diff-detail', '#date-diff-weeks', '#date-diff-workdays', '#date-diff-weekends'].forEach(function (selector) {
          setText($(selector), '—');
        });
      }
    }

    function recalcAdd() {
      try {
        var result = E.addDaysToDate(dateBase.value, parseInput(dateDays));
        setText($('#date-add-result'), result.formatted);
        setText($('#date-add-weekday'), 'День недели: ' + result.weekday);
      } catch (err) {
        setText($('#date-add-result'), '—');
        setText($('#date-add-weekday'), err.message);
      }
    }

    function recalcAge() {
      try {
        var result = E.ageCalculation(dateBirth.value, today);
        setText($('#date-age-result'), result.years + ' ' + plural(result.years, ['год', 'года', 'лет']));
        setText($('#date-age-detail'), result.years + ' г. ' + result.months + ' мес. ' + result.days + ' дн.');
        var days = result.daysUntilBirthday;
        setText($('#date-bday'), days === 0 ? 'сегодня' : days === 1 ? 'завтра' : days + ' ' + plural(days, ['день', 'дня', 'дней']));
      } catch (err) {
        setText($('#date-age-result'), '—');
        setText($('#date-age-detail'), err.message);
        setText($('#date-bday'), '—');
      }
    }

    [dateA, dateB].forEach(function (input) {
      input.addEventListener('change', recalcDiff);
      input.addEventListener('input', recalcDiff);
    });
    [dateBase, dateDays].forEach(function (input) {
      input.addEventListener('change', recalcAdd);
      input.addEventListener('input', recalcAdd);
    });
    if (dateBirth) {
      dateBirth.addEventListener('change', recalcAge);
      dateBirth.addEventListener('input', recalcAge);
    }

    recalcDiff();
    recalcAdd();
    recalcAge();
  }

  /* ------------------------------------------------------------------ *
   *  Запуск
   * ------------------------------------------------------------------ */

  function init() {
    initChrome();
    initTabs();
    initScientific();
    initPercent();
    initFinance();
    initUnits();
    initHealth();
    initDates();

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawActiveChart, 120);
    });

    // Перерисовываем график после смены темы (цвета берутся из CSS-переменных).
    var observer = new MutationObserver(function () {
      drawActiveChart();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {
          /* офлайн-режим просто не включится */
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

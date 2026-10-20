/* Калькулятор всего — вычислительное ядро.
 * Работает и в браузере (window.CalcEngine), и в Node (module.exports),
 * чтобы логику можно было покрыть тестами.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CalcEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Форматирование
   * ------------------------------------------------------------------ */

  function cleanNumber(value) {
    if (!Number.isFinite(value)) return value;
    return Number(value.toPrecision(12));
  }

  function formatNumber(value, maxFractionDigits) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    if (!Number.isFinite(value)) return '∞';
    var max = maxFractionDigits == null ? 8 : maxFractionDigits;
    var n = cleanNumber(value);
    if (n === 0) n = 0;
    var abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) {
      return n
        .toExponential(6)
        .replace(/\.?0+e/, 'e')
        .replace('e+', 'e');
    }
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: max,
      minimumFractionDigits: 0
    }).format(n);
  }

  function formatMoney(value, currency) {
    if (!Number.isFinite(value)) return '—';
    try {
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: currency || 'RUB',
        maximumFractionDigits: 2
      }).format(cleanNumber(value));
    } catch (err) {
      return formatNumber(value, 2);
    }
  }

  function parseNumeric(value) {
    if (typeof value === 'number') return value;
    if (value == null) return NaN;
    var normalized = String(value)
      .replace(/\s|\u00a0/g, '')
      .replace(',', '.');
    if (normalized === '') return NaN;
    return Number(normalized);
  }

  /* ------------------------------------------------------------------ *
   *  Разбор и вычисление выражений
   * ------------------------------------------------------------------ */

  var CONSTANTS = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2
  };

  var FUNCTIONS = {
    sin: 1, cos: 1, tan: 1,
    asin: 1, acos: 1, atan: 1,
    sqrt: 1, cbrt: 1,
    ln: 1, log: 1, log2: 1, log10: 1,
    abs: 1, exp: 1,
    floor: 1, ceil: 1, round: 1, sign: 1,
    fact: 1
  };

  function tokenize(input) {
    var source = String(input)
      .replace(/[×х]/gi, '*')
      .replace(/[÷:]/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/π/g, 'pi')
      .replace(/,/g, '.')
      .replace(/[\s\u00a0]+/g, '');

    var tokens = [];
    var i = 0;

    while (i < source.length) {
      var ch = source[i];

      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      if (/[0-9.]/.test(ch)) {
        var start = i;
        var dots = 0;
        while (i < source.length && /[0-9.]/.test(source[i])) {
          if (source[i] === '.') dots += 1;
          i += 1;
        }
        // Экспоненциальная запись: 1e3, 2.5e-4
        if (i < source.length && /[eE]/.test(source[i])) {
          var save = i;
          i += 1;
          if (source[i] === '+' || source[i] === '-') i += 1;
          if (/[0-9]/.test(source[i] || '')) {
            while (i < source.length && /[0-9]/.test(source[i])) i += 1;
          } else {
            i = save;
          }
        }
        var raw = source.slice(start, i);
        if (dots > 1 || raw === '.') {
          throw new Error('Некорректное число: ' + raw);
        }
        tokens.push({ type: 'num', value: Number(raw) });
        continue;
      }

      if (/[a-zA-Zа-яА-Я]/.test(ch)) {
        var nameStart = i;
        while (i < source.length && /[a-zA-Zа-яА-Я0-9_]/.test(source[i])) i += 1;
        var name = source.slice(nameStart, i).toLowerCase();
        tokens.push({ type: 'id', name: name });
        continue;
      }

      if ('+-*/^%!()'.indexOf(ch) !== -1) {
        tokens.push({ type: ch === '(' ? 'lparen' : ch === ')' ? 'rparen' : 'op', op: ch });
        i += 1;
        continue;
      }

      throw new Error('Неизвестный символ: «' + ch + '»');
    }

    return tokens;
  }

  function factorial(value) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Факториал определён для целых неотрицательных чисел');
    }
    if (value > 170) throw new Error('Слишком большое значение для факториала');
    var result = 1;
    for (var k = 2; k <= value; k += 1) result *= k;
    return result;
  }

  function evaluate(expression, options) {
    var opts = options || {};
    var angleMode = opts.angleMode === 'rad' ? 'rad' : 'deg';
    var tokens = tokenize(expression);

    if (!tokens.length) throw new Error('Введите выражение');

    var pos = 0;

    function peek() {
      return tokens[pos];
    }

    function consume() {
      return tokens[pos++];
    }

    function isOp(value) {
      var token = peek();
      return Boolean(token && token.op === value);
    }

    function startsPrimary(token) {
      return Boolean(token && (token.type === 'num' || token.type === 'id' || token.type === 'lparen'));
    }

    function toRadians(value) {
      return angleMode === 'deg' ? (value * Math.PI) / 180 : value;
    }

    function fromRadians(value) {
      return angleMode === 'deg' ? (value * 180) / Math.PI : value;
    }

    function callFunction(name, argument) {
      switch (name) {
        case 'sin': return Math.sin(toRadians(argument));
        case 'cos': return Math.cos(toRadians(argument));
        case 'tan': return Math.tan(toRadians(argument));
        case 'asin': return fromRadians(Math.asin(argument));
        case 'acos': return fromRadians(Math.acos(argument));
        case 'atan': return fromRadians(Math.atan(argument));
        case 'sqrt': return Math.sqrt(argument);
        case 'cbrt': return Math.cbrt(argument);
        case 'ln': return Math.log(argument);
        case 'log':
        case 'log10': return Math.log10(argument);
        case 'log2': return Math.log2(argument);
        case 'abs': return Math.abs(argument);
        case 'exp': return Math.exp(argument);
        case 'floor': return Math.floor(argument);
        case 'ceil': return Math.ceil(argument);
        case 'round': return Math.round(argument);
        case 'sign': return Math.sign(argument);
        case 'fact': return factorial(argument);
        default: throw new Error('Неизвестная функция: ' + name);
      }
    }

    function parseExpression() {
      var left = parseTerm();
      var value = left.value;
      var isPercent = left.percent;

      while (isOp('+') || isOp('-')) {
        var op = consume().op;
        var right = parseTerm();
        if (right.percent) {
          // «200 + 10%» = 220, как в обычном калькуляторе.
          value = op === '+' ? value + value * right.value : value - value * right.value;
        } else {
          value = op === '+' ? value + right.value : value - right.value;
        }
        isPercent = false;
      }

      return { value: value, percent: isPercent };
    }

    function parseTerm() {
      var left = parseUnary();
      var value = left.value;
      var isPercent = left.percent;

      while (true) {
        if (isOp('*') || isOp('/')) {
          var op = consume().op;
          var right = parseUnary();
          if (op === '/') {
            if (right.value === 0) throw new Error('Деление на ноль');
            value /= right.value;
          } else {
            value *= right.value;
          }
          isPercent = false;
          continue;
        }
        if (startsPrimary(peek())) {
          // Неявное умножение: 2pi, 3(4+5), 2sin(30).
          var implicit = parseUnary();
          value *= implicit.value;
          isPercent = false;
          continue;
        }
        break;
      }

      return { value: value, percent: isPercent };
    }

    function parseUnary() {
      if (isOp('+') || isOp('-')) {
        var op = consume().op;
        var operand = parseUnary();
        return { value: op === '-' ? -operand.value : operand.value, percent: operand.percent };
      }
      return parsePower();
    }

    function parsePower() {
      var base = parsePostfix();
      if (isOp('^')) {
        consume();
        var exponent = parseUnary();
        return { value: Math.pow(base.value, exponent.value), percent: false };
      }
      return base;
    }

    function parsePostfix() {
      var token = parsePrimary();
      var value = token.value;
      var isPercent = false;

      while (true) {
        if (isOp('!')) {
          consume();
          value = factorial(value);
          isPercent = false;
          continue;
        }
        if (isOp('%')) {
          consume();
          value /= 100;
          isPercent = true;
          continue;
        }
        break;
      }

      return { value: value, percent: isPercent };
    }

    function parsePrimary() {
      var token = peek();
      if (!token) throw new Error('Выражение не закончено');

      if (token.type === 'num') {
        consume();
        return { value: token.value, percent: false };
      }

      if (token.type === 'id') {
        consume();
        var name = token.name;
        if (Object.prototype.hasOwnProperty.call(FUNCTIONS, name)) {
          if (!isOp('(')) throw new Error('После функции нужна скобка: ' + name);
          consume();
          var argument = parseExpression().value;
          if (!isOp(')')) throw new Error('Не хватает закрывающей скобки');
          consume();
          var result = callFunction(name, argument);
          if (name === 'fact') return { value: result, percent: false };
          return { value: result, percent: false };
        }
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
          return { value: CONSTANTS[name], percent: false };
        }
        throw new Error('Неизвестная функция или константа: ' + name);
      }

      if (token.type === 'lparen') {
        consume();
        var inner = parseExpression();
        if (!isOp(')')) throw new Error('Не хватает закрывающей скобки');
        consume();
        return inner;
      }

      throw new Error('Неожиданный символ: ' + (token.op || token.name || token.type));
    }

    var parsed = parseExpression();
    if (pos < tokens.length) {
      throw new Error('Лишний символ: ' + (tokens[pos].op || tokens[pos].name));
    }
    if (!Number.isFinite(parsed.value)) {
      throw new Error('Результат не является числом');
    }

    return cleanNumber(parsed.value);
  }

  /* ------------------------------------------------------------------ *
   *  Единицы измерения
   * ------------------------------------------------------------------ */

  var UNIT_CATEGORIES = [
    {
      id: 'length',
      name: 'Длина',
      base: 'м',
      units: [
        { id: 'mm', name: 'Миллиметр', short: 'мм', factor: 0.001 },
        { id: 'cm', name: 'Сантиметр', short: 'см', factor: 0.01 },
        { id: 'm', name: 'Метр', short: 'м', factor: 1 },
        { id: 'km', name: 'Километр', short: 'км', factor: 1000 },
        { id: 'in', name: 'Дюйм', short: 'in', factor: 0.0254 },
        { id: 'ft', name: 'Фут', short: 'ft', factor: 0.3048 },
        { id: 'yd', name: 'Ярд', short: 'yd', factor: 0.9144 },
        { id: 'mi', name: 'Миля', short: 'mi', factor: 1609.344 },
        { id: 'nmi', name: 'Морская миля', short: 'nmi', factor: 1852 },
        { id: 'um', name: 'Микрометр', short: 'мкм', factor: 1e-6 },
        { id: 'nm', name: 'Нанометр', short: 'нм', factor: 1e-9 }
      ]
    },
    {
      id: 'mass',
      name: 'Масса',
      base: 'кг',
      units: [
        { id: 'mg', name: 'Миллиграмм', short: 'мг', factor: 1e-6 },
        { id: 'g', name: 'Грамм', short: 'г', factor: 0.001 },
        { id: 'kg', name: 'Килограмм', short: 'кг', factor: 1 },
        { id: 't', name: 'Тонна', short: 'т', factor: 1000 },
        { id: 'lb', name: 'Фунт', short: 'lb', factor: 0.45359237 },
        { id: 'oz', name: 'Унция', short: 'oz', factor: 0.028349523125 },
        { id: 'st', name: 'Стоун', short: 'st', factor: 6.35029318 },
        { id: 'ct', name: 'Карат', short: 'ct', factor: 0.0002 }
      ]
    },
    {
      id: 'area',
      name: 'Площадь',
      base: 'м²',
      units: [
        { id: 'mm2', name: 'Кв. миллиметр', short: 'мм²', factor: 1e-6 },
        { id: 'cm2', name: 'Кв. сантиметр', short: 'см²', factor: 0.0001 },
        { id: 'm2', name: 'Кв. метр', short: 'м²', factor: 1 },
        { id: 'km2', name: 'Кв. километр', short: 'км²', factor: 1e6 },
        { id: 'ha', name: 'Гектар', short: 'га', factor: 10000 },
        { id: 'sotka', name: 'Сотка', short: 'сот.', factor: 100 },
        { id: 'acre', name: 'Акр', short: 'acre', factor: 4046.8564224 },
        { id: 'ft2', name: 'Кв. фут', short: 'ft²', factor: 0.09290304 },
        { id: 'in2', name: 'Кв. дюйм', short: 'in²', factor: 0.00064516 },
        { id: 'yd2', name: 'Кв. ярд', short: 'yd²', factor: 0.83612736 }
      ]
    },
    {
      id: 'volume',
      name: 'Объём',
      base: 'л',
      units: [
        { id: 'ml', name: 'Миллилитр', short: 'мл', factor: 0.001 },
        { id: 'l', name: 'Литр', short: 'л', factor: 1 },
        { id: 'm3', name: 'Куб. метр', short: 'м³', factor: 1000 },
        { id: 'cm3', name: 'Куб. сантиметр', short: 'см³', factor: 0.001 },
        { id: 'galus', name: 'Галлон (США)', short: 'gal', factor: 3.785411784 },
        { id: 'galuk', name: 'Галлон (UK)', short: 'gal UK', factor: 4.54609 },
        { id: 'qt', name: 'Кварта (США)', short: 'qt', factor: 0.946352946 },
        { id: 'pt', name: 'Пинта (США)', short: 'pt', factor: 0.473176473 },
        { id: 'cup', name: 'Чашка (США)', short: 'cup', factor: 0.2365882365 },
        { id: 'floz', name: 'Жидк. унция (США)', short: 'fl oz', factor: 0.0295735295625 },
        { id: 'tbsp', name: 'Столовая ложка', short: 'ст. л.', factor: 0.01478676478125 },
        { id: 'tsp', name: 'Чайная ложка', short: 'ч. л.', factor: 0.00492892159375 }
      ]
    },
    {
      id: 'speed',
      name: 'Скорость',
      base: 'м/с',
      units: [
        { id: 'ms', name: 'Метр в секунду', short: 'м/с', factor: 1 },
        { id: 'kmh', name: 'Километр в час', short: 'км/ч', factor: 1 / 3.6 },
        { id: 'mph', name: 'Миля в час', short: 'mph', factor: 0.44704 },
        { id: 'knot', name: 'Узел', short: 'уз.', factor: 1852 / 3600 },
        { id: 'fts', name: 'Фут в секунду', short: 'ft/s', factor: 0.3048 },
        { id: 'mach', name: 'Мах (при 20 °C)', short: 'Mach', factor: 343 }
      ]
    },
    {
      id: 'temperature',
      name: 'Температура',
      base: 'K',
      units: [
        { id: 'c', name: 'Цельсий', short: '°C' },
        { id: 'f', name: 'Фаренгейт', short: '°F' },
        { id: 'k', name: 'Кельвин', short: 'K' }
      ]
    },
    {
      id: 'time',
      name: 'Время',
      base: 'с',
      units: [
        { id: 'ms', name: 'Миллисекунда', short: 'мс', factor: 0.001 },
        { id: 's', name: 'Секунда', short: 'с', factor: 1 },
        { id: 'min', name: 'Минута', short: 'мин', factor: 60 },
        { id: 'h', name: 'Час', short: 'ч', factor: 3600 },
        { id: 'd', name: 'Сутки', short: 'сут.', factor: 86400 },
        { id: 'wk', name: 'Неделя', short: 'нед.', factor: 604800 },
        { id: 'mo', name: 'Месяц (30,44 сут.)', short: 'мес.', factor: 2629800 },
        { id: 'yr', name: 'Год (365,25 сут.)', short: 'г.', factor: 31557600 }
      ]
    },
    {
      id: 'data',
      name: 'Данные',
      base: 'байт',
      units: [
        { id: 'bit', name: 'Бит', short: 'бит', factor: 0.125 },
        { id: 'byte', name: 'Байт', short: 'Б', factor: 1 },
        { id: 'kb', name: 'Килобайт', short: 'КБ', factor: 1e3 },
        { id: 'mb', name: 'Мегабайт', short: 'МБ', factor: 1e6 },
        { id: 'gb', name: 'Гигабайт', short: 'ГБ', factor: 1e9 },
        { id: 'tb', name: 'Терабайт', short: 'ТБ', factor: 1e12 },
        { id: 'kib', name: 'Кибибайт', short: 'КиБ', factor: 1024 },
        { id: 'mib', name: 'Мебибайт', short: 'МиБ', factor: 1048576 },
        { id: 'gib', name: 'Гибибайт', short: 'ГиБ', factor: 1073741824 },
        { id: 'tib', name: 'Тебибайт', short: 'ТиБ', factor: 1099511627776 }
      ]
    },
    {
      id: 'pressure',
      name: 'Давление',
      base: 'Па',
      units: [
        { id: 'pa', name: 'Паскаль', short: 'Па', factor: 1 },
        { id: 'kpa', name: 'Килопаскаль', short: 'кПа', factor: 1000 },
        { id: 'mpa', name: 'Мегапаскаль', short: 'МПа', factor: 1e6 },
        { id: 'bar', name: 'Бар', short: 'бар', factor: 1e5 },
        { id: 'atm', name: 'Атмосфера', short: 'атм', factor: 101325 },
        { id: 'mmhg', name: 'Миллиметр рт. ст.', short: 'мм рт. ст.', factor: 133.322387415 },
        { id: 'psi', name: 'Фунт на кв. дюйм', short: 'psi', factor: 6894.757293168 }
      ]
    },
    {
      id: 'energy',
      name: 'Энергия',
      base: 'Дж',
      units: [
        { id: 'j', name: 'Джоуль', short: 'Дж', factor: 1 },
        { id: 'kj', name: 'Килоджоуль', short: 'кДж', factor: 1000 },
        { id: 'cal', name: 'Калория', short: 'кал', factor: 4.184 },
        { id: 'kcal', name: 'Килокалория', short: 'ккал', factor: 4184 },
        { id: 'wh', name: 'Ватт-час', short: 'Вт·ч', factor: 3600 },
        { id: 'kwh', name: 'Киловатт-час', short: 'кВт·ч', factor: 3.6e6 },
        { id: 'ev', name: 'Электронвольт', short: 'эВ', factor: 1.602176634e-19 },
        { id: 'btu', name: 'BTU', short: 'BTU', factor: 1055.05585262 }
      ]
    },
    {
      id: 'power',
      name: 'Мощность',
      base: 'Вт',
      units: [
        { id: 'w', name: 'Ватт', short: 'Вт', factor: 1 },
        { id: 'kw', name: 'Киловатт', short: 'кВт', factor: 1000 },
        { id: 'mw', name: 'Мегаватт', short: 'МВт', factor: 1e6 },
        { id: 'hpmetric', name: 'Лошадиная сила (метрич.)', short: 'л.с.', factor: 735.49875 },
        { id: 'hpmech', name: 'Лошадиная сила (мех.)', short: 'hp', factor: 745.699871582 },
        { id: 'kcalh', name: 'Килокалория в час', short: 'ккал/ч', factor: 1.163 }
      ]
    },
    {
      id: 'angle',
      name: 'Угол',
      base: 'рад',
      units: [
        { id: 'deg', name: 'Градус', short: '°', factor: Math.PI / 180 },
        { id: 'rad', name: 'Радиан', short: 'рад', factor: 1 },
        { id: 'grad', name: 'Град', short: 'град', factor: Math.PI / 200 },
        { id: 'turn', name: 'Оборот', short: 'об.', factor: Math.PI * 2 },
        { id: 'arcmin', name: 'Угловая минута', short: '′', factor: Math.PI / 10800 },
        { id: 'arcsec', name: 'Угловая секунда', short: '″', factor: Math.PI / 648000 }
      ]
    }
  ];

  function getUnitCategory(categoryId) {
    for (var i = 0; i < UNIT_CATEGORIES.length; i += 1) {
      if (UNIT_CATEGORIES[i].id === categoryId) return UNIT_CATEGORIES[i];
    }
    return null;
  }

  function getUnit(category, unitId) {
    for (var i = 0; i < category.units.length; i += 1) {
      if (category.units[i].id === unitId) return category.units[i];
    }
    return null;
  }

  function temperatureToKelvin(unitId, value) {
    if (unitId === 'c') return value + 273.15;
    if (unitId === 'f') return (value - 32) / 1.8 + 273.15;
    return value;
  }

  function temperatureFromKelvin(unitId, value) {
    if (unitId === 'c') return value - 273.15;
    if (unitId === 'f') return (value - 273.15) * 1.8 + 32;
    return value;
  }

  function convertUnit(categoryId, fromId, toId, value) {
    var category = getUnitCategory(categoryId);
    if (!category) throw new Error('Неизвестная категория');
    var from = getUnit(category, fromId);
    var to = getUnit(category, toId);
    if (!from || !to) throw new Error('Неизвестная единица');
    if (!Number.isFinite(value)) throw new Error('Введите число');

    if (category.id === 'temperature') {
      return temperatureFromKelvin(to.id, temperatureToKelvin(from.id, value));
    }
    return (value * from.factor) / to.factor;
  }

  /* ------------------------------------------------------------------ *
   *  Финансы
   * ------------------------------------------------------------------ */

  function creditCalculation(input) {
    var amount = parseNumeric(input.amount);
    var annualRate = parseNumeric(input.annualRate);
    var months = Math.round(parseNumeric(input.months));
    var type = input.type === 'diff' ? 'diff' : 'annuity';

    if (!(amount > 0)) throw new Error('Сумма кредита должна быть больше нуля');
    if (!(annualRate >= 0)) throw new Error('Ставка не может быть отрицательной');
    if (!(months > 0) || months > 1200) throw new Error('Укажите срок от 1 до 1200 месяцев');

    var rate = annualRate / 100 / 12;
    var schedule = [];
    var total = 0;
    var monthly = 0;

    if (type === 'annuity') {
      monthly = rate === 0 ? amount / months : (amount * rate) / (1 - Math.pow(1 + rate, -months));
      var balance = amount;
      for (var m = 1; m <= months; m += 1) {
        var interest = balance * rate;
        var principal = monthly - interest;
        if (m === months) {
          principal = balance;
        }
        balance = Math.max(0, balance - principal);
        var payment = principal + interest;
        total += payment;
        schedule.push({ month: m, payment: payment, principal: principal, interest: interest, balance: balance });
      }
    } else {
      var share = amount / months;
      var rest = amount;
      for (var k = 1; k <= months; k += 1) {
        var diffInterest = rest * rate;
        var diffPayment = share + diffInterest;
        rest = Math.max(0, rest - share);
        total += diffPayment;
        schedule.push({ month: k, payment: diffPayment, principal: share, interest: diffInterest, balance: rest });
      }
      monthly = schedule[0].payment;
    }

    return {
      monthly: monthly,
      firstPayment: schedule[0].payment,
      lastPayment: schedule[schedule.length - 1].payment,
      total: total,
      overpayment: total - amount,
      months: months,
      schedule: schedule
    };
  }

  function depositCalculation(input) {
    var amount = parseNumeric(input.amount);
    var annualRate = parseNumeric(input.annualRate);
    var months = Math.round(parseNumeric(input.months));
    var capitalization = Math.round(parseNumeric(input.capitalization));
    var monthlyAdd = parseNumeric(input.monthlyAdd) || 0;
    var taxRate = parseNumeric(input.taxRate) || 0;

    if (!(amount >= 0)) throw new Error('Сумма не может быть отрицательной');
    if (!(annualRate >= 0)) throw new Error('Ставка не может быть отрицательной');
    if (!(months > 0) || months > 1200) throw new Error('Укажите срок от 1 до 1200 месяцев');
    if (!(monthlyAdd >= 0)) throw new Error('Пополнение не может быть отрицательным');
    if (!(taxRate >= 0 && taxRate <= 100)) throw new Error('Налог должен быть от 0 до 100%');

    var monthRate = annualRate / 100 / 12;
    var balance = amount;
    var accrued = 0;
    var totalInterest = 0;
    var schedule = [];

    for (var m = 1; m <= months; m += 1) {
      var interest = balance * monthRate;
      if (capitalization > 0 && m % capitalization === 0) {
        balance += accrued + interest;
        accrued = 0;
      } else {
        accrued += interest;
      }
      totalInterest += interest;
      balance += monthlyAdd;
      schedule.push({
        month: m,
        balance: balance + accrued,
        interest: totalInterest
      });
    }

    var gross = balance + accrued;
    var tax = totalInterest * (taxRate / 100);
    var net = gross - tax;
    var invested = amount + monthlyAdd * months;
    var profit = net - invested;

    return {
      gross: gross,
      net: net,
      tax: tax,
      interest: totalInterest,
      invested: invested,
      profit: profit,
      yieldPercent: invested > 0 ? (profit / invested) * 100 : 0,
      schedule: schedule
    };
  }

  /* ------------------------------------------------------------------ *
   *  Здоровье
   * ------------------------------------------------------------------ */

  function bmiCalculation(weightKg, heightCm) {
    var weight = parseNumeric(weightKg);
    var height = parseNumeric(heightCm);
    if (!(weight > 0) || !(height > 0)) throw new Error('Укажите вес и рост');
    if (height > 300) throw new Error('Проверьте рост в сантиметрах');

    var meters = height / 100;
    var bmi = weight / (meters * meters);
    var category = 'Ожирение III степени';
    var tone = 'danger';

    if (bmi < 16) { category = 'Выраженный дефицит массы'; tone = 'danger'; }
    else if (bmi < 18.5) { category = 'Недостаточная масса'; tone = 'warning'; }
    else if (bmi < 25) { category = 'Норма'; tone = 'good'; }
    else if (bmi < 30) { category = 'Избыточная масса'; tone = 'warning'; }
    else if (bmi < 35) { category = 'Ожирение I степени'; tone = 'danger'; }
    else if (bmi < 40) { category = 'Ожирение II степени'; tone = 'danger'; }

    return {
      bmi: bmi,
      category: category,
      tone: tone,
      healthyMin: 18.5 * meters * meters,
      healthyMax: 24.9 * meters * meters,
      position: Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100))
    };
  }

  var ACTIVITY_LEVELS = [
    { id: '1.2', name: 'Минимальная активность', factor: 1.2 },
    { id: '1.375', name: '1–3 тренировки в неделю', factor: 1.375 },
    { id: '1.55', name: '3–5 тренировок в неделю', factor: 1.55 },
    { id: '1.725', name: '6–7 тренировок в неделю', factor: 1.725 },
    { id: '1.9', name: 'Тяжёлая работа и спорт', factor: 1.9 }
  ];

  function calorieCalculation(input) {
    var sex = input.sex === 'female' ? 'female' : 'male';
    var age = parseNumeric(input.age);
    var height = parseNumeric(input.height);
    var weight = parseNumeric(input.weight);
    var factor = parseNumeric(input.activity) || 1.2;

    if (!(age > 0) || !(height > 0) || !(weight > 0)) {
      throw new Error('Заполните возраст, рост и вес');
    }

    var bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
    var tdee = bmr * factor;
    var protein = weight * 1.6;
    var fat = (tdee * 0.25) / 9;
    var carbs = Math.max(0, (tdee - protein * 4 - fat * 9) / 4);

    return {
      bmr: bmr,
      tdee: tdee,
      goals: [
        { id: 'lose', label: 'Похудение −15%', kcal: tdee * 0.85 },
        { id: 'soft', label: 'Мягкий дефицит −10%', kcal: tdee * 0.9 },
        { id: 'keep', label: 'Поддержание', kcal: tdee },
        { id: 'gain', label: 'Набор +10%', kcal: tdee * 1.1 }
      ],
      macros: { protein: protein, fat: fat, carbs: carbs },
      water: weight * 30
    };
  }

  /* ------------------------------------------------------------------ *
   *  Даты
   * ------------------------------------------------------------------ */

  function parseDateParts(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) throw new Error('Введите дату');
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    var utc = Date.UTC(y, m - 1, d);
    var check = new Date(utc);
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
      throw new Error('Некорректная дата');
    }
    return { y: y, m: m, d: d, utc: utc };
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function formatDateUTC(parts) {
    var date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }

  function weekdayUTC(parts) {
    var date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
    return new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' }).format(date);
  }

  function addMonthsClamped(parts, count) {
    var total = parts.y * 12 + (parts.m - 1) + count;
    var year = Math.floor(total / 12);
    var month = (total % 12) + 1;
    var day = Math.min(parts.d, daysInMonth(year, month));
    return { y: year, m: month, d: day, utc: Date.UTC(year, month - 1, day) };
  }

  function dateDifference(startValue, endValue) {
    var start = parseDateParts(startValue);
    var end = parseDateParts(endValue);
    var sign = 1;
    if (end.utc < start.utc) {
      var tmp = start;
      start = end;
      end = tmp;
      sign = -1;
    }

    var totalDays = Math.round((end.utc - start.utc) / 86400000);
    var totalMonths = (end.y * 12 + end.m) - (start.y * 12 + start.m);
    var anchor = addMonthsClamped(start, totalMonths);
    if (anchor.utc > end.utc) {
      totalMonths -= 1;
      anchor = addMonthsClamped(start, totalMonths);
    }
    var years = Math.floor(totalMonths / 12);
    var months = totalMonths % 12;
    var days = Math.round((end.utc - anchor.utc) / 86400000);

    var workdays = 0;
    for (var t = start.utc; t < end.utc; t += 86400000) {
      var dayOfWeek = new Date(t).getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workdays += 1;
    }

    return {
      sign: sign,
      totalDays: totalDays,
      years: years,
      months: months,
      days: days,
      weeks: Math.floor(totalDays / 7),
      remainderDays: totalDays % 7,
      workdays: workdays,
      weekendDays: totalDays - workdays,
      startFormatted: formatDateUTC(start),
      endFormatted: formatDateUTC(end)
    };
  }

  function addDaysToDate(dateValue, amount) {
    var parts = parseDateParts(dateValue);
    var days = Math.round(parseNumeric(amount));
    if (!Number.isFinite(days)) throw new Error('Введите количество дней');
    var result = new Date(parts.utc + days * 86400000);
    var out = {
      y: result.getUTCFullYear(),
      m: result.getUTCMonth() + 1,
      d: result.getUTCDate(),
      utc: result.getTime()
    };
    return {
      date: out,
      formatted: formatDateUTC(out),
      weekday: weekdayUTC(out),
      iso: out.y + '-' + String(out.m).padStart(2, '0') + '-' + String(out.d).padStart(2, '0')
    };
  }

  function ageCalculation(birthValue, todayValue) {
    var birth = parseDateParts(birthValue);
    var today = todayValue ? parseDateParts(todayValue) : parseDateParts(new Date().toISOString().slice(0, 10));
    if (birth.utc > today.utc) throw new Error('Дата рождения в будущем');

    var diff = dateDifference(birthValue, todayValue || new Date().toISOString().slice(0, 10));
    var nextYear = today.y;
    var nextDay = Math.min(birth.d, daysInMonth(nextYear, birth.m));
    if (Date.UTC(nextYear, birth.m - 1, nextDay) < today.utc) {
      nextYear += 1;
      nextDay = Math.min(birth.d, daysInMonth(nextYear, birth.m));
    }
    var nextBirthday = addDaysToDate(
      nextYear + '-' + String(birth.m).padStart(2, '0') + '-' + String(nextDay).padStart(2, '0'),
      0
    );
    var daysUntil = Math.round((nextBirthday.date.utc - today.utc) / 86400000);

    return {
      years: diff.years,
      months: diff.months,
      days: diff.days,
      totalDays: diff.totalDays,
      nextBirthday: nextBirthday.formatted,
      nextBirthdayWeekday: nextBirthday.weekday,
      daysUntilBirthday: daysUntil
    };
  }

  return {
    formatNumber: formatNumber,
    formatMoney: formatMoney,
    parseNumeric: parseNumeric,
    evaluate: evaluate,
    unitCategories: UNIT_CATEGORIES,
    convertUnit: convertUnit,
    creditCalculation: creditCalculation,
    depositCalculation: depositCalculation,
    bmiCalculation: bmiCalculation,
    calorieCalculation: calorieCalculation,
    activityLevels: ACTIVITY_LEVELS,
    dateDifference: dateDifference,
    addDaysToDate: addDaysToDate,
    ageCalculation: ageCalculation,
    cleanNumber: cleanNumber
  };
});

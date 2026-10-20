/* Тесты вычислительного ядра: node tests/engine.test.js */
'use strict';

var assert = require('assert');
var E = require('../assets/js/engine.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (error) {
    failed += 1;
    console.error('  ✗ ' + name);
    console.error('    ' + error.message);
  }
}

function near(actual, expected, epsilon) {
  var eps = epsilon == null ? 1e-9 : epsilon;
  assert.ok(
    Math.abs(actual - expected) <= eps,
    'ожидалось ' + expected + ', получено ' + actual
  );
}

function throws(fn, pattern) {
  var didThrow = false;
  try {
    fn();
  } catch (error) {
    didThrow = true;
    if (pattern) assert.ok(pattern.test(error.message), 'неожиданный текст ошибки: ' + error.message);
  }
  assert.ok(didThrow, 'ожидалась ошибка');
}

console.log('\nВыражения');
test('приоритет операций', function () {
  assert.strictEqual(E.evaluate('2 + 2 * 3'), 8);
});
test('скобки и неявное умножение', function () {
  assert.strictEqual(E.evaluate('(2 + 3)(4 + 1)'), 25);
  assert.strictEqual(E.evaluate('2 * (3 + 4)'), 14);
});
test('степень правоассоциативна', function () {
  assert.strictEqual(E.evaluate('2^3^2'), 512);
  assert.strictEqual(E.evaluate('-2^2'), -4);
  assert.strictEqual(E.evaluate('2^-3'), 0.125);
});
test('факториал и корень', function () {
  assert.strictEqual(E.evaluate('sqrt(16) + 3!'), 10);
  assert.strictEqual(E.evaluate('5! / (2! * 3!)'), 10);
});
test('константы и неявное умножение', function () {
  near(E.evaluate('2π'), Math.PI * 2);
  near(E.evaluate('3e'), Math.E * 3);
});
test('тригонометрия в градусах', function () {
  assert.strictEqual(E.evaluate('sin(30)', { angleMode: 'deg' }), 0.5);
  assert.strictEqual(E.evaluate('cos(60)', { angleMode: 'deg' }), 0.5);
});
test('тригонометрия в радианах', function () {
  near(E.evaluate('sin(pi/2)', { angleMode: 'rad' }), 1);
  near(E.evaluate('cos(0)', { angleMode: 'rad' }), 1);
});
test('логарифмы', function () {
  assert.strictEqual(E.evaluate('log(100)'), 2);
  assert.strictEqual(E.evaluate('ln(e)'), 1);
  assert.strictEqual(E.evaluate('log2(8)'), 3);
});
test('проценты в сложении', function () {
  assert.strictEqual(E.evaluate('200 + 10%'), 220);
  assert.strictEqual(E.evaluate('200 - 10%'), 180);
  assert.strictEqual(E.evaluate('100 + 10% + 10%'), 121);
});
test('проценты в умножении и отдельно', function () {
  assert.strictEqual(E.evaluate('200 * 10%'), 20);
  assert.strictEqual(E.evaluate('10%'), 0.1);
});
test('плавающая точка округляется', function () {
  assert.strictEqual(E.evaluate('0.1 + 0.2'), 0.3);
});
test('пробелы, запятая, спецсимволы', function () {
  assert.strictEqual(E.evaluate('1 000 + 1'), 1001);
  assert.strictEqual(E.evaluate('2,5 * 4'), 10);
  assert.strictEqual(E.evaluate('6 ÷ 2 × 3'), 9);
});
test('ошибки выражений', function () {
  throws(function () { E.evaluate('1 / 0'); }, /Деление на ноль/);
  throws(function () { E.evaluate('2 +'); }, /не закончено/);
  throws(function () { E.evaluate('foo(2)'); }, /Неизвестная/);
  throws(function () { E.evaluate('(2 + 3'); }, /скобк/);
  throws(function () { E.evaluate('(-2)!'); }, /Факториал/);
  throws(function () { E.evaluate(''); }, /Введите/);
});

console.log('\nЕдиницы');
test('длина', function () {
  assert.strictEqual(E.convertUnit('length', 'km', 'm', 1), 1000);
  near(E.convertUnit('length', 'mi', 'km', 1), 1.609344);
  near(E.convertUnit('length', 'in', 'cm', 1), 2.54);
});
test('температура', function () {
  assert.strictEqual(E.convertUnit('temperature', 'c', 'f', 0), 32);
  near(E.convertUnit('temperature', 'f', 'c', 100), 37.7777777778, 1e-6);
  assert.strictEqual(E.convertUnit('temperature', 'c', 'f', -40), -40);
  assert.strictEqual(E.convertUnit('temperature', 'c', 'k', 0), 273.15);
});
test('данные', function () {
  assert.strictEqual(E.convertUnit('data', 'gb', 'mb', 1), 1000);
  assert.strictEqual(E.convertUnit('data', 'gib', 'mib', 1), 1024);
});
test('давление и угол', function () {
  near(E.convertUnit('pressure', 'bar', 'psi', 1), 14.503773773, 1e-6);
  near(E.convertUnit('angle', 'deg', 'rad', 180), Math.PI);
});
test('масса и объём', function () {
  near(E.convertUnit('mass', 'kg', 'lb', 1), 2.2046226218, 1e-6);
  near(E.convertUnit('volume', 'l', 'ml', 1), 1000);
});
test('неизвестная единица', function () {
  throws(function () { E.convertUnit('length', 'nope', 'm', 1); }, /Неизвестная единица/);
});

console.log('\nКредит');
test('аннуитет', function () {
  var result = E.creditCalculation({ amount: 1000000, annualRate: 17.5, months: 60, type: 'annuity' });
  assert.strictEqual(result.schedule.length, 60);
  assert.ok(result.monthly > 25000 && result.monthly < 25200, 'месячный платёж: ' + result.monthly);
  near(result.total, result.monthly * 60, 0.05);
  near(result.overpayment, result.total - 1000000, 0.05);
  near(result.schedule[59].balance, 0, 1e-6);
});
test('аннуитет под 0%', function () {
  var result = E.creditCalculation({ amount: 120000, annualRate: 0, months: 12 });
  near(result.monthly, 10000);
  near(result.total, 120000);
  near(result.overpayment, 0);
});
test('дифференцированный платёж', function () {
  var result = E.creditCalculation({ amount: 1000000, annualRate: 17.5, months: 60, type: 'diff' });
  assert.ok(result.firstPayment > result.lastPayment, 'первый платёж должен быть больше последнего');
  near(result.schedule[59].balance, 0, 1e-6);
  near(result.overpayment, result.total - 1000000, 0.05);
});
test('ошибки кредита', function () {
  throws(function () { E.creditCalculation({ amount: 0, annualRate: 10, months: 12 }); }, /больше нуля/);
  throws(function () { E.creditCalculation({ amount: 1000, annualRate: 10, months: 0 }); }, /срок/);
});

console.log('\nВклад');
test('без капитализации', function () {
  var result = E.depositCalculation({ amount: 500000, annualRate: 18, months: 12, capitalization: 0 });
  near(result.gross, 590000, 0.01);
  near(result.interest, 90000, 0.01);
});
test('ежемесячная капитализация', function () {
  var result = E.depositCalculation({ amount: 500000, annualRate: 18, months: 12, capitalization: 1 });
  near(result.gross, 500000 * Math.pow(1.015, 12), 0.01);
  assert.ok(result.gross > 590000);
});
test('налог с процентов', function () {
  var result = E.depositCalculation({ amount: 500000, annualRate: 18, months: 12, capitalization: 0, taxRate: 13 });
  near(result.tax, 90000 * 0.13, 0.01);
  near(result.net, result.gross - result.tax, 0.01);
  near(result.profit, result.net - 500000, 0.01);
});
test('пополнения', function () {
  var result = E.depositCalculation({ amount: 100000, annualRate: 12, months: 12, capitalization: 1, monthlyAdd: 10000 });
  near(result.invested, 220000, 0.01);
  assert.ok(result.gross > 220000);
  assert.strictEqual(result.schedule.length, 12);
});
test('ошибки вклада', function () {
  throws(function () { E.depositCalculation({ amount: 1000, annualRate: 10, months: -1 }); }, /срок/);
  throws(function () { E.depositCalculation({ amount: 1000, annualRate: 10, months: 12, taxRate: 150 }); }, /Налог/);
});

console.log('\nЗдоровье');
test('ИМТ', function () {
  var result = E.bmiCalculation(70, 175);
  near(result.bmi, 22.8571428571, 1e-6);
  assert.strictEqual(result.category, 'Норма');
  assert.strictEqual(result.tone, 'good');
  near(result.healthyMin, 56.65625, 1e-6);
  near(result.healthyMax, 76.25625, 1e-6);
});
test('категории ИМТ', function () {
  assert.strictEqual(E.bmiCalculation(50, 170).category, 'Недостаточная масса');
  assert.strictEqual(E.bmiCalculation(95, 170).category, 'Ожирение I степени');
  throws(function () { E.bmiCalculation(0, 170); }, /вес и рост/);
});
test('калории', function () {
  var result = E.calorieCalculation({ sex: 'male', age: 30, height: 175, weight: 70, activity: 1.375 });
  near(result.bmr, 1648.75, 1e-6);
  near(result.tdee, 2267.03125, 1e-6);
  assert.strictEqual(result.goals.length, 4);
  near(result.water, 2100);
  assert.ok(result.macros.protein > 0 && result.macros.fat > 0 && result.macros.carbs > 0);
});

console.log('\nДаты');
test('разница в году', function () {
  var result = E.dateDifference('2024-01-01', '2025-01-01');
  assert.strictEqual(result.totalDays, 366);
  assert.strictEqual(result.years, 1);
  assert.strictEqual(result.months, 0);
  assert.strictEqual(result.days, 0);
  assert.strictEqual(result.workdays, 262);
  assert.strictEqual(result.weekendDays, 104);
});
test('разница по месяцам', function () {
  var result = E.dateDifference('2024-01-31', '2024-03-01');
  assert.strictEqual(result.totalDays, 30);
  assert.strictEqual(result.years, 0);
  assert.strictEqual(result.months, 1);
  assert.strictEqual(result.days, 1);
});
test('обратный порядок дат', function () {
  var result = E.dateDifference('2025-01-01', '2024-01-01');
  assert.strictEqual(result.sign, -1);
  assert.strictEqual(result.totalDays, 366);
});
test('прибавление дней', function () {
  var result = E.addDaysToDate('2026-10-20', 30);
  assert.strictEqual(result.iso, '2026-11-19');
  assert.strictEqual(result.weekday, 'четверг');
  assert.strictEqual(E.addDaysToDate('2024-03-01', -1).iso, '2024-02-29');
});
test('возраст', function () {
  var result = E.ageCalculation('2000-05-15', '2026-10-20');
  assert.strictEqual(result.years, 26);
  assert.strictEqual(result.months, 5);
  assert.strictEqual(result.days, 5);
  assert.ok(result.daysUntilBirthday > 0);
});
test('день рождения 29 февраля', function () {
  var result = E.ageCalculation('2000-02-29', '2026-10-20');
  assert.strictEqual(result.years, 26);
  assert.ok(result.daysUntilBirthday > 0);
  assert.ok(!/Некорректная/.test(result.nextBirthday));

  var after = E.ageCalculation('2000-02-29', '2027-03-01');
  assert.ok(after.daysUntilBirthday > 300, 'после 28 февраля должен ждать 2028 год, а не −1 день');
});
test('некорректная дата', function () {
  throws(function () { E.dateDifference('2024-02-30', '2024-03-01'); }, /Некорректная/);
  throws(function () { E.ageCalculation('2030-01-01', '2026-01-01'); }, /будущем/);
});

console.log('\nФорматирование');
test('разделители и округление', function () {
  assert.strictEqual(E.formatNumber(1234567.891, 2).replace(/\s/g, ' '), '1 234 567,89');
});
test('очень большие и малые числа', function () {
  assert.ok(/e/.test(E.formatNumber(1e15, 2)));
  assert.ok(/e/.test(E.formatNumber(1e-9, 2)));
});
test('деньги', function () {
  assert.ok(/₽|\$|€/.test(E.formatMoney(1234.5, 'RUB')));
  assert.ok(/\$/.test(E.formatMoney(1234.5, 'USD')));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);

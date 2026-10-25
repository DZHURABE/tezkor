/* The owner's rules: sign-up without Telegram, one region, shop areas, price table, single sizes, pay by phone, pre-orders — node test/owner.test.js */
const assert = require('assert'); const { createServer: cs0 } = require('../src/core/server.js'); const Rules = require('../src/core/rules.js');
const NOV = { channels: () => [], start: () => ({}) };
let now = new Date(2026, 9, 15, 13, 0).getTime();   // 13:00 local (the demo restaurants are open)
const S = cs0({ verify: NOV, now: () => now });
let pass = 0; const t = (n, f) => { f(); pass++; console.log('✓', n); };
const call = (m, u, b, tok) => S.handle(m, u, b, tok);
const ok = r => { if (!r.body.ok) throw new Error(JSON.stringify(r.body)); return r.body.data; };
const err = (r, code) => { assert.equal(r.body.ok, false, 'expected error ' + code); assert.equal(r.body.error.code, code); };
const login = p => ok(call('POST', '/auth/login', { phone: p, password: '1234' })).token;
const R1 = login('900000101'), K1 = login('900000201'), A = login('900000001');
const addr = { text: 'кӯчаи Рӯдакӣ 10', landmark: 'назди боғ', lat: 37.268, lng: 68.145 };
const items = [{ productId: 'r1p1', qty: 2 }, { productId: 'r1p2', qty: 1 }];
const deliver = (id) => { ok(call('POST', `/restaurant/orders/${id}/accept`, { prepMin: 10 }, R1)); ok(call('PATCH', '/courier/me', { online: true }, K1));
  ok(call('POST', `/courier/orders/${id}/accept`, {}, K1)); ok(call('POST', `/restaurant/orders/${id}/ready`, {}, R1));
  ok(call('POST', `/courier/orders/${id}/pickup`, {}, K1)); return ok(call('POST', `/courier/orders/${id}/deliver`, {}, K1)); };

let friend;
t('рўйхат: фақат исм, телефон, парол (Telegram талаб қилинмайди)', () => {
  const S2 = cs0({ verify: { channels: () => [{ id: 'tg', kind: 'telegram' }], start: () => ({}) }, now: () => now });
  const A2 = S2.handle('POST', '/auth/login', { phone: '900000001', password: '1234' }).body.data.token;
  S2.handle('PATCH', '/admin/settings', { verifyRequired: true }, A2);
  const r = S2.handle('POST', '/auth/register', { name: 'Алишер', phone: '93 555 11 22', password: '5555' });
  assert.ok(r.body.ok, JSON.stringify(r.body)); assert.equal(r.body.data.user.role, 'customer');
  friend = ok(call('POST', '/auth/register', { name: 'Дӯст', phone: '93 700 00 02', password: '5555' })).token; });
t('шаҳар йўқ: битта минтақа, деҳалар ўчирилган', () => { assert.equal(ok(call('GET', '/cities')).length, 1); assert.equal(ok(call('GET', '/areas')).length, 0);
  const all = ok(call('GET', '/restaurants')), f = ok(call('GET', '/restaurants?cityId=c1')); assert.equal(f.length, all.length, 'town filter is ignored'); });
t('бонус ва даъват ўчирилган', () => { const s = ok(call('GET', '/settings/public')); assert.equal(s.loyalty.on, false); assert.equal(s.loyalty.refOn, false);
  const q = ok(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: addr, useBonus: true }, friend)); assert.equal(q.bonusUsed, 0); });
t('ҳудуд: дўкон атрофида айлана (шаҳар маркази эмас)', () => { const r1 = ok(call('GET', '/restaurants/r1'));
  const near = { lat: r1.lat + 4 / 111, lng: r1.lng, text: 'кӯча 1' }, far = { lat: r1.lat + 6 / 111, lng: r1.lng, text: 'кӯча 2' };
  assert.ok(ok(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: near }, friend)).deliveryFee >= 0);
  err(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: far }, friend), 'OUT_OF_ZONE'); });
t('нарх жадвали: 100 м — 1, 300 м — 3, 1 км — 5, кейин ҳар км +2, ёмғир +2', () => {
  ok(call('POST', '/admin/delivery-prices', { deliveryTiers: [{ m: 100, fee: 1 }, { m: 300, fee: 3 }, { m: 1000, fee: 5 }], deliveryExtraKm: 2, weatherOn: 0, weatherFee: 2 }, A));
  const s = ok(call('GET', '/settings/public')); assert.equal(Rules.deliveryFee(s, 0.1), 1); assert.equal(Rules.deliveryFee(s, 0.3), 3); assert.equal(Rules.deliveryFee(s, 0.8), 5); assert.equal(Rules.deliveryFee(s, 2.5), 9);
  const r1 = ok(call('GET', '/restaurants/r1')), a = { lat: r1.lat + 0.25 / 111, lng: r1.lng, text: 'кӯча 3' };
  assert.equal(ok(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: a }, friend)).deliveryFee, 3);
  ok(call('POST', '/admin/delivery-prices', { weatherOn: 1 }, A)); assert.equal(ok(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: a }, friend)).deliveryFee, 5);
  ok(call('POST', '/admin/delivery-prices', { weatherOn: 0 }, A));
  err(call('POST', '/admin/delivery-prices', { deliveryTiers: [{ m: 300, fee: 3 }, { m: 100, fee: 1 }] }, A), 'BAD_TIERS');
  err(call('POST', '/admin/delivery-prices', { deliveryTiers: [{ m: 100, fee: 1 }] }, friend), 'FORBIDDEN'); });
t('мағоза: битта ўлчам (50 кг, 1 л) сақланади', () => { ok(call('POST', '/admin/own-shop', {}, A)); const cat = ok(call('GET', '/categories?shop=1'))[0].id;
  const p = ok(call('POST', '/restaurant/products', { name: 'Орди гандум', categoryId: cat, kind: 'box', brand: 'Ватан', variants: [{ label: '50 кг', price: 320 }] }, A));
  assert.equal(p.weight, '50 кг'); assert.equal(p.price, 320); assert.ok(!p.variants || !p.variants.length);
  const w = ok(call('POST', '/restaurant/products', { name: 'Об', categoryId: cat, kind: 'box', variants: [{ label: '1 л', price: 3 }] }, A)); assert.equal(w.weight, '1 л');
  const two = ok(call('POST', '/restaurant/products', { name: 'Шарбат', categoryId: cat, kind: 'box', variants: [{ label: '1 л', price: 6 }, { label: '10 л', price: 40 }] }, A)); assert.equal(two.variants.length, 2); });
t('ошхона қўшиш: шаҳарсиз, обуна ва комиссиясиз, харитадаги жой', () => {
  const r = ok(call('POST', '/admin/restaurants', { name: 'Мағозаи Шоҳ', kind: 'shop', ownerPhone: '93 600 00 01', address: 'Шоҳ', lat: 37.20, lng: 68.05, zone: [{ lat: 37.21, lng: 68.04 }, { lat: 37.21, lng: 68.06 }, { lat: 37.19, lng: 68.05 }] }, A));
  assert.equal(r.commissionPct, 0); assert.ok(!r.paidUntil); assert.equal(r.lat, 37.20); assert.equal(r.zone.length, 3); assert.equal(r.sub.state, 'none'); });
t('курьер: шаҳарсиз, транспортни ўзи ёзади', () => { const c = ok(call('POST', '/admin/couriers', { name: 'Ҷамол', phone: '93 600 00 02', vehicle: 'Мошини Нексия', carNumber: '01 TJ 1234' }, A));
  assert.equal(c.courier.vehicle, 'Мошини Нексия'); const c2 = ok(call('POST', '/admin/couriers', { name: 'Бобур', phone: '93 600 00 03', vehicle: 'Скутер' }, A)); assert.equal(c2.courier.vehicle, 'scooter'); });
t('эълон тўлови: фақат телефон рақами', () => { const c = ok(call('POST', '/admin/pay-cards', { phone: '93 777 77 77', bank: 'Алиф' }, A)); assert.equal(c.number, ''); assert.equal(c.phone, '+992937777777');
  err(call('POST', '/admin/pay-cards', { bank: 'Алиф' }, A), 'BAD_PHONE'); });
t('«Расонидани таом» ҳам ўчирилади', () => { ok(call('PATCH', '/admin/services/food', { on: false }, A)); assert.equal(ok(call('GET', '/settings/public')).services.food, false);
  ok(call('PATCH', '/admin/services/food', { on: true }, A)); assert.equal(ok(call('GET', '/settings/public')).services.food, true); });
/* ---- orders for later ---- */
t('вақти наздик рад', () => err(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: addr, scheduledAt: now + 10 * 60000 }, friend), 'SCHED_TOO_SOON'));
t('вақти дур рад', () => err(call('POST', '/orders/quote', { restaurantId: 'r1', items, address: addr, scheduledAt: now + 10 * 86400000 }, friend), 'SCHED_TOO_FAR'));
let so;
t('фармоиш барои соати 16:00: интизор', () => { so = ok(call('POST', '/orders', { restaurantId: 'r1', items, address: addr, paymentMethod: 'cash', scheduledAt: now + 3 * 3600000 }, friend));
  assert.equal(so.status, 'scheduled'); assert.ok(Rules.ACTIVE.includes('scheduled'));
  const n = ok(call('GET', '/notifications', null, R1)); assert.ok(n.some(x => x.key === 'n.schedNew' && x.orderId === so.id)); assert.ok(!n.some(x => x.key === 'n.newOrder' && x.orderId === so.id)); });
t('ошхона ҳоло қабул карда наметавонад', () => err(call('POST', `/restaurant/orders/${so.id}/accept`, { prepMin: 10 }, R1), 'BAD_TRANSITION'));
t('40 дақиқа пеш ба ошхона меравад, бе эскалатсия', () => { now += 3 * 3600000 - 40 * 60000; ok(call('GET', '/cities'));
  const o = ok(call('GET', '/orders/' + so.id, null, friend)); assert.equal(o.status, 'pending'); assert.ok(!o.escalated, 'not escalated right away');
  assert.ok(ok(call('GET', '/notifications', null, R1)).some(x => x.key === 'n.newOrder' && x.orderId === so.id)); deliver(so.id); });
t('мизоҷ фармоиши интизорро бекор мекунад', () => { const x = ok(call('POST', '/orders', { restaurantId: 'r1', items, address: addr, paymentMethod: 'cash', scheduledAt: now + 5 * 3600000 }, friend));
  assert.equal(x.status, 'scheduled'); assert.equal(ok(call('POST', `/orders/${x.id}/cancel`, {}, friend)).status, 'cancelled'); });
t('курьер ўша аккаунт билан харид қилади', () => { const K = login('900000201');
  const o = ok(call('POST', '/orders', { restaurantId: 'r1', items, address: addr, paymentMethod: 'cash' }, K)); assert.equal(o.status, 'pending');
  assert.ok(ok(call('GET', '/orders/my', null, K)).some(x => x.id === o.id)); assert.equal(ok(call('GET', '/orders/' + o.id, null, K)).id, o.id);
  ok(call('POST', `/orders/${o.id}/cancel`, {}, K)); ok(call('POST', '/auth/me/addresses', { kind: 'home', text: 'Уй', lat: 37.27, lng: 68.14 }, K)); });
t('дўкон: 24 соат ва иш вақти', () => { ok(call('PATCH', '/restaurant/me', { hours: { from: '00:00', to: '00:00' } }, A)); assert.ok(Rules.isOpenAt({ from: '00:00', to: '00:00' }, new Date()));
  ok(call('PATCH', '/restaurant/me', { hours: { from: '08:00', to: '21:00' } }, A)); assert.equal(ok(call('GET', '/restaurant/me', null, A)).hours.to, '21:00'); });
t('0,445 л ўлчами сақланади', () => { const cat = ok(call('GET', '/categories?shop=1'))[0].id;
  const p = ok(call('POST', '/restaurant/products', { name: 'RC Cola', categoryId: cat, kind: 'box', variants: [{ label: '0,445 л', price: 4, stock: 24 }] }, A)); assert.equal(p.weight, '0,445 л'); assert.equal(p.stock, 24); });
t('такси ва дорихона «скоро» бўлиб турибди, ёқиб бўлмайди', () => { const l = ok(call('GET', '/admin/services', null, A)); const tx = l.find(x => x.key === 'taxi'); assert.ok(tx && !tx.ready && !tx.on); err(call('PATCH', '/admin/services/taxi', { on: true }, A), 'SERVICE_NOT_READY'); });
t('SMS: янги буюртмада дўкон ва админга (ёқилганда)', () => { const sent = []; const S3 = cs0({ verify: NOV, now: () => now, alertSms: (ph, tx) => sent.push([ph, tx]) });
  const c3 = (m, u, b, tk) => S3.handle(m, u, b, tk), o3 = r => { if (!r.body.ok) throw new Error(JSON.stringify(r.body)); return r.body.data; };
  const A3 = o3(c3('POST', '/auth/login', { phone: '900000001', password: '1234' })).token, C3 = o3(c3('POST', '/auth/login', { phone: '900000301', password: '1234' })).token;
  o3(c3('POST', '/orders', { restaurantId: 'r1', items, address: addr, paymentMethod: 'cash' }, C3)); assert.equal(sent.length, 0, 'off by default');
  o3(c3('PATCH', '/admin/settings', { smsAlerts: true }, A3)); const o = o3(c3('POST', '/orders', { restaurantId: 'r1', items: [{ productId: 'r1p1', qty: 3 }], address: addr, paymentMethod: 'cash' }, C3));
  assert.ok(sent.some(x => x[1].indexOf('№' + o.number) >= 0), JSON.stringify(sent)); });
t('тўлов: ҳамён, корт, нақд — алоҳида ёқиб-ўчирилади', () => {
  ok(call('PATCH', '/admin/settings', { payCash: false, payWallet: true, payCardTr: false }, A)); let s = ok(call('GET', '/settings/public'));
  assert.equal(s.cashEnabled, false); assert.equal(s.walletEnabled, true); assert.equal(s.cardTrEnabled, false);
  err(call('POST', '/orders', { restaurantId: 'r1', items: [{ productId: 'r1p1', qty: 4 }], address: addr, paymentMethod: 'cash' }, friend), 'PAY_METHOD_OFF');
  err(call('PATCH', '/admin/settings', { payCash: false, payWallet: false, payCardTr: false }, A), 'NO_PAY_METHOD');
  s = ok(call('GET', '/settings/public')); assert.equal(s.walletEnabled, true, 'refused change is not kept');
  ok(call('PATCH', '/admin/settings', { payCash: true, payWallet: true, payCardTr: true }, A)); assert.equal(ok(call('GET', '/settings/public')).cardTrEnabled, true); });
t('админ: фармоиши пешакӣ танзимоти', () => { ok(call('PATCH', '/admin/loyalty', { schedLeadMin: 60 }, A)); assert.equal(ok(call('GET', '/settings/public')).loyalty.schedLeadMin, 60);
  err(call('PATCH', '/admin/loyalty', { schedDays: 99 }, A), 'BAD_VALUE'); ok(call('PATCH', '/admin/loyalty', { schedLeadMin: 40 }, A)); });
t('минтақа: бир неча алоҳида қисм (деҳалар), орасидаги дашт кирмайди', () => {
  const two = [{ lat: 37.21, lng: 68.04 }, { lat: 37.21, lng: 68.06 }, { lat: 37.19, lng: 68.05 }, { lat: 37.31, lng: 68.04, cut: 1 }, { lat: 37.31, lng: 68.06 }, { lat: 37.29, lng: 68.05 }];
  assert.ok(Rules.inPolygon({ lat: 37.205, lng: 68.05 }, two)); assert.ok(Rules.inPolygon({ lat: 37.305, lng: 68.05 }, two)); assert.ok(!Rules.inPolygon({ lat: 37.25, lng: 68.05 }, two));
  const r = ok(call('POST', '/admin/restaurants/r1/zone', { zone: two }, A)); assert.equal(r.zone.filter(x => x.cut).length, 1);
  err(call('POST', '/admin/restaurants/r1/zone', { zone: two.slice(0, 5) }, A), 'BAD_ZONE');
  ok(call('POST', '/admin/restaurants/r1/zone', { zone: [] }, A)); });

console.log(`\n${pass} tests passed`);

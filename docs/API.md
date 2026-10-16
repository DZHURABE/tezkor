# SOMON FOOD — REST API

Base URL: `/api`. Auth: `Authorization: Bearer <token>` (from `POST /auth/login`).
Responses: `{ ok: true, data }` or `{ ok: false, error: { code } }` with HTTP 400/401/403/404/409/422.

| Method | Path | Access |
|---|---|---|
| POST | `/auth/login` | public |
| POST | `/auth/register` | public |
| GET | `/auth/me` | any signed-in |
| POST | `/auth/logout` | any signed-in |
| PATCH | `/auth/me` | any signed-in |
| GET | `/cities` | public |
| GET | `/categories` | public |
| GET | `/banners` | public |
| GET | `/settings/public` | public |
| GET | `/restaurants` | public |
| GET | `/restaurants/:id` | public |
| GET | `/products/popular` | public |
| GET | `/products/:id` | public |
| GET | `/search` | public |
| POST | `/promos/validate` | public |
| POST | `/orders/quote` | customer |
| POST | `/orders` | customer |
| POST | `/orders/:id/pay` | customer |
| GET | `/orders/my` | customer |
| GET | `/orders/:id` | any signed-in |
| POST | `/orders/:id/cancel` | customer |
| POST | `/orders/:id/review` | customer |
| GET | `/notifications` | any signed-in |
| POST | `/notifications/read` | any signed-in |
| GET | `/restaurant/me` | restaurant |
| PATCH | `/restaurant/me` | restaurant |
| GET | `/restaurant/orders` | restaurant |
| POST | `/restaurant/orders/:id/accept` | restaurant |
| POST | `/restaurant/orders/:id/reject` | restaurant |
| POST | `/restaurant/orders/:id/ready` | restaurant |
| GET | `/restaurant/products` | restaurant |
| POST | `/restaurant/products` | restaurant |
| PATCH | `/restaurant/products/:id` | restaurant |
| DELETE | `/restaurant/products/:id` | restaurant |
| GET | `/restaurant/stats` | restaurant |
| PATCH | `/courier/me` | courier |
| GET | `/courier/orders/available` | courier |
| GET | `/courier/orders/active` | courier |
| POST | `/courier/orders/:id/accept` | courier |
| POST | `/courier/orders/:id/pickup` | courier |
| POST | `/courier/orders/:id/deliver` | courier |
| GET | `/courier/earnings` | courier |
| GET | `/courier/history` | courier |
| GET | `/admin/dashboard` | admin |
| GET | `/admin/orders` | admin |
| POST | `/admin/orders/:id/status` | admin |
| GET | `/admin/restaurants` | admin |
| POST | `/admin/restaurants` | admin |
| PATCH | `/admin/restaurants/:id` | admin |
| GET | `/admin/users` | admin |
| PATCH | `/admin/users/:id` | admin |
| POST | `/admin/couriers` | admin |
| GET | `/admin/categories` | admin |
| POST | `/admin/categories` | admin |
| PATCH | `/admin/categories/:id` | admin |
| DELETE | `/admin/categories/:id` | admin |
| GET | `/admin/products` | admin |
| PATCH | `/admin/products/:id` | admin |
| GET | `/admin/promos` | admin |
| POST | `/admin/promos` | admin |
| PATCH | `/admin/promos/:id` | admin |
| GET | `/admin/banners` | admin |
| PATCH | `/admin/banners/:id` | admin |
| GET | `/admin/cities` | admin |
| POST | `/admin/cities` | admin |
| PATCH | `/admin/cities/:id` | admin |
| GET | `/admin/payments` | admin |
| GET | `/admin/settings` | admin |
| PATCH | `/admin/settings` | admin |
| POST | `/admin/reset-demo` | admin |

Extra (HTTP server only): `GET /health`, `POST /api/payments/webhook/:provider`, `GET /api/maps/route?fromLat&fromLng&toLat&toLng`.

## Order state machine

```
awaiting_payment ─pay→ pending ─accept(restaurant)→ cooking ─ready(restaurant)→ ready ─pickup(courier)→ picked_up ─deliver(courier)→ delivered
pending ─reject(restaurant)→ rejected        pending ─cancel(customer)→ cancelled        cooking/ready ─cancel(admin)→ cancelled
```
Card payments are refunded automatically on reject/cancel. Money split on delivery: commission = commission% × subtotal; courier = courierPct% × delivery fee; platform = commission + (fee − courier).

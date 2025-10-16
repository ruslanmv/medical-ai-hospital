# Gateway API — Summary

Base URL: `http://localhost:8080`

## Auth
- `POST /auth/register` — `{ email, password }`
- `POST /auth/login` — sets HttpOnly cookie if success
- `POST /auth/logout` — clears session cookie
- `GET /auth/me` — returns `{ id, email, is_verified }`

## Me / Patient
- `GET /me/patient` — profile snapshot or `null` if not linked
- `PUT /me/patient` — updates demographics (whitelisted fields)

## Chat
- `POST /chat/send` — `{ message?, args? }` → forwards to MCP tool
- `GET /chat/events` — SSE stream proxied from MCP

## Error Model
- Errors return JSON `{ detail: string }` and appropriate HTTP status.

## Auth Model
- Cookie name: `sid` (configurable)
- Cookies are HttpOnly; frontend must send `credentials: 'include'`.

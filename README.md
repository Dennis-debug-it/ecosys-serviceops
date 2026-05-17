# Ecosys ServiceOps

## Required environment variables

Backend runtime:

- `ECOSYS_DB_CONNECTION`
  Example: `Host=localhost;Port=5432;Database=ecosys_serviceops;Username=postgres;Password=postgres`
- `ECOSYS_JWT_SIGNING_KEY`
- `ECOSYS_PLATFORM_ADMIN_EMAIL`
- `ECOSYS_PLATFORM_ADMIN_PASSWORD`
- `ECOSYS_PLATFORM_ADMIN_FULL_NAME`

SMTP, when email delivery is enabled:

- `ECOSYS_SMTP_HOST`
- `ECOSYS_SMTP_PORT`
- `ECOSYS_SMTP_USE_SSL`
- `ECOSYS_SMTP_USERNAME`
- `ECOSYS_SMTP_PASSWORD`

CORS:

- `ECOSYS_CORS_ALLOWED_ORIGINS`
  Comma-separated list such as `https://app.example.com,https://ops.example.com`

ASP.NET Core standard environment variable mappings also work:

- `ConnectionStrings__DefaultConnection`
- `Jwt__SigningKey`
- `Smtp__Host`
- `Smtp__Port`
- `Smtp__UseSsl`
- `Smtp__Username`
- `Smtp__Password`
- `PlatformAdmin__Email`
- `PlatformAdmin__Password`
- `PlatformAdmin__FullName`

## Deployment notes

- Swagger is exposed only in `Development`.
- `api/dev/*` endpoints are development-only and hidden from API explorer.
- Local uploads are stored under `storage/uploads/` and must not be committed.
- Attachment downloads go through authorized API endpoints instead of direct public file serving.
- Frontend Playwright commands should be run from `ecosys-serviceops-frontend`.
- Run Playwright commands sequentially to avoid the Vite web-server port race on `4173`.

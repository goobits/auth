## 2024-05-23 - [Incomplete Redaction Keys]
**Vulnerability:** Audit logs were potentially exposing sensitive credentials like `api_key` and `client_secret` because the default redaction list was incomplete.
**Learning:** Generic redaction lists (`password`, `token`) are insufficient for applications that handle diverse credential types (OAuth secrets, API keys, verification tokens).
**Prevention:** Regularly audit the data models and API parameters to update the redaction blocklist in `src/utils/redact.ts`.

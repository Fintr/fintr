# API request parameters (Fintr backend)

## Incoming JSON and query strings: use snake_case in Ruby only

Clients (web, mobile) typically send **lowerCamelCase** keys in JSON bodies and query strings, matching the shape of API responses.

Before any controller runs, the **`SnakeCaseParameters`** middleware (`apps/fintr-be/app/middlewares/snake_case_parameters.rb`) normalizes those keys:

- It runs `deep_transform_keys!(&:underscore)` on **`request.request_parameters`** and **`request.query_parameters`**.
- After this step, **`params` in controllers are snake_case** for top-level keys (and nested object keys).

Therefore:

1. **Do not** `permit` or read duplicate keys in both snake_case and camelCase (for example `liked_areas` and `likedAreas`). That is redundant, easy to drift, and suggests a misunderstanding of the stack.
2. **Do** use **snake_case only** in `params.permit(...)`, `params[:...]`, and any hashes you pass into operations—same as the database and domain layer.

## Responses stay lowerCamelCase

Success and error payloads go through **`Transformers::LowerCamelKeys`** (see `app/controllers/concerns/api_responses.rb`). Outbound JSON keys are lowerCamel for the client. That is independent of inbound normalization.

## Summary

| Direction | Key style   | Where it happens |
|-----------|-------------|------------------|
| Request   | snake_case in controllers | After `SnakeCaseParameters` |
| Response  | lowerCamel  | `ApiResponses` + `LowerCamelKeys` |

If you add a new endpoint, assume **`params` are already underscored** for request bodies and query params that went through the middleware.

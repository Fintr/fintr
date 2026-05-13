# frozen_string_literal: true

# Underscores all keys on incoming request and query parameters so controllers
# only ever see snake_case. Do not duplicate camelCase keys in controllers; see
# docs/API_REQUEST_PARAMETERS.md
class SnakeCaseParameters
  def initialize(app)
    @app = app
  end

  def call(env)
    request = ActionDispatch::Request.new(env)
    request.request_parameters.deep_transform_keys!(&:underscore)
    request.query_parameters.deep_transform_keys!(&:underscore)

    @app.call(env)
  end
end

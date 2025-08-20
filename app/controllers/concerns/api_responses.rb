# frozen_string_literal: true

module ApiResponses
  extend ActiveSupport::Concern

  private

  # ----- Success Responses -----

  def render_success(data: nil, status: :ok, message: "Success")
    response_body = { success: true, message: }
    response_body[:data] = data if data.present?
    transformed_data = Transformers::LowerCamelKeys.transform(response_body)
    render json: transformed_data, status: status
  end

  def render_created(record:, message: nil)
    klass = record.class.name.demodulize
    message ||= "Resource #{klass} created successfully"
    render_success(data: { id: record.id }, status: :created, message:)
  end

  # ----- Error Responses -----

  # Generic error rendering method
  def render_error(message:, status:, details: nil)
    error_payload = { message: }
    error_payload[:details] = details if details.present?
    transformed_data = Transformers::LowerCamelKeys.transform(error_payload)

    render json: { success: false, error: transformed_data }, status: status
  end

  # Specific error helpers
  def render_bad_request(message: "Bad Request", details: nil)
    render_error(message:, status: :bad_request, details:)
  end

  def render_unauthorized(message: "Unauthorized", details: nil)
    render_error(message:, status: :unauthorized, details:)
  end

  def render_forbidden(message: "Forbidden", details: nil)
    render_error(message:, status: :forbidden, details:)
  end

  def render_not_found(message: "Resource not found", details: nil)
    render_error(message:, status: :not_found, details:)
  end

  # Often used for validation errors. `details` can contain the error messages.
  def render_unprocessable_content(message: "Unprocessable Entity", details: nil)
    render_error(message:, status: :unprocessable_content, details:)
  end

  def render_internal_server_error(message: "Internal Server Error", details: nil)
    # Optionally log the error here in a real application
    # Rails.logger.error("[Internal Server Error] #{message} - Details: #{details}")
    render_error(message:, status: :internal_server_error, details:)
  end

  # Helper specifically for ActiveRecord validation errors
  def render_validation_errors(*records)
    details = records.map { |record| [record.class.name.demodulize, record.errors] }.to_h
    render_unprocessable_content(message: "Validation Failed", details:)
  end
end

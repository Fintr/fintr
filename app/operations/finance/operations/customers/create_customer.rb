# frozen_string_literal: true

require "securerandom"

module Finance
  module Operations
    module Customers
      class CreateCustomer < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:email).value(:string)
            optional(:reference_id).maybe(:string)
            optional(:given_names).maybe(:string)
            optional(:surname).maybe(:string)
            optional(:space_id).maybe(:string)
            optional(:metadata).maybe(:hash)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params          = step validate(params:)
          xendit_response = step create_xendit_customer(params:)
          xendit_response
        end

        private

        def create_xendit_customer(params:)
          client = Integrations::Payments::Xendit::Client.new

          # Generate reference_id if not provided
          reference_id = params[:reference_id] || "cust-#{SecureRandom.uuid}"

          # Build metadata, including space_id if provided
          metadata = params[:metadata] || {}
          metadata = metadata.merge(space_id: params[:space_id]) if params[:space_id].present?

          response = client.create_customer(
            given_names: params[:given_names],
            surname: params[:surname],
            email: params[:email],
            reference_id: reference_id,
            type: params[:type] || "INDIVIDUAL",
            metadata: metadata
          )

          # Include reference_id in response for storage
          response_with_reference = response.merge(reference_id: response[:reference_id] || reference_id)

          Success(response_with_reference)
        rescue Integrations::Payments::Xendit::Error => e
          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to create Xendit customer: #{e.message}")
        end
      end
    end
  end
end

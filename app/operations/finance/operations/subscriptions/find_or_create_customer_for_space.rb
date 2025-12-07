# frozen_string_literal: true

require "securerandom"

module Finance
  module Operations
    module Subscriptions
      class FindOrCreateCustomerForSpace < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            optional(:email).maybe(:string)
            optional(:given_names).maybe(:string)
            optional(:surname).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params        = step validate(params:)
          space         = step find_space(params:)
          customer_data = step find_or_create_customer(space:, params:)

          customer_data
        end

        private

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def find_or_create_customer(space:, params:)
          # If space already has a customer, return it
          if space.xendit_customer_id.present? && space.xendit_customer_reference_id.present?
            return Success(
              id: space.xendit_customer_id,
              reference_id: space.xendit_customer_reference_id
            )
          end

          # Otherwise, create a new customer
          # Use space owner's email if available, otherwise use a generated email
          first_user = space.users.order(created_at: :asc).first
          email = params[:email] || first_user&.email || "space-#{space.id}@fintr.app"
          given_names = params[:given_names] || first_user&.full_name&.split&.first || "Space"
          surname = params[:surname] || first_user&.full_name&.split&.last || "Owner"

          customer_data = step Customers::CreateCustomer.new.call(
            email: email,
            given_names: given_names,
            surname: surname,
            reference_id: "space-#{space.id}-#{SecureRandom.uuid}",
            space_id: space.id.to_s
          )

          # Store customer info on space
          space.update!(
            xendit_customer_id: customer_data[:id],
            xendit_customer_reference_id: customer_data[:reference_id]
          )

          Success(customer_data)
        end
      end
    end
  end
end

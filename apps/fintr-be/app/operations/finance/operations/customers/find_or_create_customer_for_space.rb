# frozen_string_literal: true

require "securerandom"

module Finance
  module Operations
    module Customers
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
          existing_customer = step reuse_stored_customer(space:)
          return Success(existing_customer) if existing_customer

          customer_data = step create_customer_for_space(space:, params:)
          step store_customer_on_space(space:, customer_data:)

          Success(customer_data)
        end

        # A space can keep a customer id from an older Xendit account. Recurring
        # plan creation then fails with DATA_NOT_FOUND, so confirm the id still
        # exists before reusing it.
        def reuse_stored_customer(space:)
          if space.xendit_customer_id.blank? || space.xendit_customer_reference_id.blank?
            return Success(nil)
          end

          client = Integrations::Payments::Xendit::Client.new
          client.get_customer(customer_id: space.xendit_customer_id)

          Success(
            id: space.xendit_customer_id,
            reference_id: space.xendit_customer_reference_id
          )
        rescue Integrations::Payments::Xendit::Error => e
          return clear_stored_customer(space:) if missing_xendit_customer?(error: e)

          Failure(
            xendit_error: e.message,
            status: e.status,
            code: e.code
          )
        end

        def missing_xendit_customer?(error:)
          error.status == 404 && error.code == "DATA_NOT_FOUND"
        end

        def clear_stored_customer(space:)
          space.update!(
            xendit_customer_id: nil,
            xendit_customer_reference_id: nil
          )

          Success(nil)
        end

        def create_customer_for_space(space:, params:)
          first_user = space.users.order(created_at: :asc).first
          email = params[:email] || first_user&.email || "space-#{space.id}@fintr.app"
          given_names = params[:given_names] || first_user&.full_name&.split&.first || "Space"
          surname = params[:surname] || first_user&.full_name&.split&.last || "Owner"

          CreateCustomer.new.call(
            email: email,
            given_names: given_names,
            surname: surname,
            reference_id: "space-#{space.id}-#{SecureRandom.uuid}",
            space_id: space.id.to_s
          )
        end

        def store_customer_on_space(space:, customer_data:)
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

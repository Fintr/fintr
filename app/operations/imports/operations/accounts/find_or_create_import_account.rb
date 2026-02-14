# frozen_string_literal: true

module Imports
  module Operations
    module Accounts
      class FindOrCreateImportAccount < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
          end
        end

        include FailureHandler

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          space = step find_space(params[:space_id])
          account = step find_or_create_account(space:)

          account
        end

        private

        def find_space(space_id)
          space = Spaces::Space.find_by(id: space_id)
          return Failure(error: "Space not found") if space.nil?

          Success(space)
        end

        def find_or_create_account(space:)
          # Handle race conditions when multiple imports try to create the same account
          # Strategy: Try to find first, if not found, try to create with retry
          account = Transactions::Account.find_by(
            space: space,
            name: "Import"
          )

          unless account
            # Try to create, but handle race condition if another process created it
            begin
              account = Transactions::Account.create!(
                space: space,
                name: "Import",
                balance_cents: 0,
                balance_currency: space.currency.presence || "PHP",
                account_category: "cash"
              )
            rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
              # Race condition: account was created by another process between find and create
              # Find it now
              account = Transactions::Account.find_by!(
                space: space,
                name: "Import"
              )
            end
          end

          Success(account)
        rescue ActiveRecord::RecordNotFound => e
          Failure(error: "Import account not found after creation attempt: #{e.message}")
        rescue StandardError => e
          Failure(error: e.message, errors: e.record&.errors&.to_hash || {})
        end
      end
    end
  end
end

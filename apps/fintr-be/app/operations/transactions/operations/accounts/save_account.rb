# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class SaveAccount < Dry::Operation
        ACTIONS = %w[save update discard create].freeze

        class Contract < Dry::Validation::Contract
          params do
            optional(:account)
            required(:cause).value(:string)
            required(:operation).value(:string)
            optional(:whodunnit).maybe(:string)
            optional(:action).value(:string)
            optional(:attributes).hash
          end

          rule(:action) do
            next if value.blank?

            key.failure("must be one of: #{ACTIONS.join(", ")}") unless ACTIONS.include?(value)
          end

          rule(:account, :action) do
            action = values[:action].presence || "save"
            next if action == "create"

            key(:account).failure("must be an account") unless values[:account].is_a?(Transactions::Account)
          end

          rule(:attributes, :action) do
            action = values[:action].presence || "save"
            next unless action.in?(%w[update create])

            key(:attributes).failure("must be provided") if values[:attributes].blank?
          end
        end

        def call(params)
          params = step validate(params:)
          action = params[:action].presence || "save"

          case action
          when "save"
            step save_account(params:)
          when "update"
            step update_account(params:)
          when "discard"
            step discard_account(params:)
          when "create"
            step create_account(params:)
          end
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def save_account(params:)
          account = params[:account]
          with_versioning(params:) { account.save! }
          Success(account)
        rescue ActiveRecord::RecordInvalid => e
          Failure(
            errors: account.errors.to_hash,
            account_name: failure_account_name(cause: params[:cause]),
            error: e,
            expected: true
          )
        rescue ActiveRecord::ActiveRecordError => e
          Failure(
            account: "failed to save",
            account_name: failure_account_name(cause: params[:cause]),
            error: e
          )
        end

        def update_account(params:)
          account = params[:account]
          with_versioning(params:) { account.update!(params[:attributes]) }
          Success(account)
        rescue ActiveRecord::RecordInvalid => e
          Failure(**account.errors.to_hash, error: e, expected: true)
        end

        def discard_account(params:)
          account = params[:account]
          with_versioning(params:) { account.discard! }
          Success(account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account: "failed to discard", account_name: "failed to update", error: e)
        end

        def create_account(params:)
          account = nil
          with_versioning(params:) do
            account = Transactions::Account.create!(params[:attributes])
          end
          Success(account)
        rescue ActiveRecord::RecordInvalid => e
          Failure(**e.record.errors.to_hash, error: e, expected: true)
        end

        def failure_account_name(cause:)
          return "failed to reverse" if cause == "loan_payment_revert_balance"

          "failed to update"
        end

        def with_versioning(params:)
          PaperTrail.request(
            whodunnit: params[:whodunnit]&.to_s,
            controller_info: {
              cause: params[:cause],
              operation: params[:operation]
            }
          ) do
            yield
          end
        end
      end
    end
  end
end

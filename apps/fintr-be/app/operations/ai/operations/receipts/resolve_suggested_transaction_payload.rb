# frozen_string_literal: true

module Ai
  module Operations
    module Receipts
      class ResolveSuggestedTransactionPayload < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:suggested_transaction_payload).hash do
              required(:amount)
              required(:date)
              required(:transaction_type).value(:string, included_in?: %w[income expense])
              required(:category_name).value(:string)
              required(:account_name).value(:string)
              required(:description).value(:string)
              optional(:schedule_type).value(:string)
            end
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params  = step validate(params:)
          payload = step resolve_category_name(params:)
          step resolve_account_name(params:, payload:)
        end

        private

        def resolve_category_name(params:)
          payload = params[:suggested_transaction_payload].dup
          resolved_name = step lookup_category_name(
            space_id: params[:space_id],
            category_name: payload[:category_name],
            transaction_type: payload[:transaction_type]
          )

          payload[:category_name] = resolved_name
          Success(payload)
        end

        def resolve_account_name(params:, payload:)
          resolved_name = step lookup_account_name(
            space_id: params[:space_id],
            account_name: payload[:account_name]
          )

          payload[:account_name] = resolved_name
          Success(payload)
        end

        def lookup_category_name(space_id:, category_name:, transaction_type:)
          resolution = Transactions::Operations::ResolveCategoryByName.new.call(
            space_id:,
            category_name:,
            category_type: transaction_type
          )
          return Success(category_name) if resolution.success?

          case_insensitive_name = find_category_name_case_insensitive(
            space_id:,
            category_name:,
            transaction_type:
          )
          return Success(case_insensitive_name) if case_insensitive_name.present?

          fallback = Transactions::Category
            .expense
            .roots
            .where(space_id:)
            .order(:name)
            .first
          return expected_failure({ category_name: "not found" }) unless fallback

          Success(fallback.name)
        end

        def lookup_account_name(space_id:, account_name:)
          account = Transactions::Account.kept.find_by(
            name: account_name,
            space_id:
          )
          return Success(account_name) if account

          case_insensitive_account = Transactions::Account.kept
            .where(space_id:)
            .where("LOWER(name) = ?", account_name.downcase)
            .order(:name)
            .first
          return Success(case_insensitive_account.name) if case_insensitive_account

          fallback = Transactions::Account.kept.where(space_id:).order(:name).first
          return expected_failure({ account_name: "not found" }) unless fallback

          Success(fallback.name)
        end

        def find_category_name_case_insensitive(space_id:, category_name:, transaction_type:)
          normalized_name = category_name.to_s.downcase.strip
          return nil if normalized_name.blank?

          scope = Transactions::Category.where(
            space_id:,
            category_type: transaction_type
          )

          parent = scope.roots.find { |category| category.name.downcase == normalized_name }
          return parent.name if parent

          subcategories = scope.subcategories
            .includes(:parent)
            .select { |category| category.name.downcase == normalized_name }

          return nil if subcategories.empty?
          return nil if subcategories.size > 1

          subcategories.first.name
        end
      end
    end
  end
end

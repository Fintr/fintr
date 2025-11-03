# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Loans
      class CreateLoan < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            # Current user and space
            required(:user_id).value(:string)
            required(:space_id).value(:string)

            # Loan details
            required(:principal_amount).value(:decimal, gt?: 0)
            required(:interest_rate).value(:decimal, gteq?: 0)
            required(:date).value(:date)
            required(:loan_type).value(:string)
            required(:entity_name).value(:string)
            required(:account_name).value(:string)
            required(:loan_term_months).value(:integer, gt?: 0)
            optional(:description).value(:string)
            optional(:file)
            optional(:file_id).maybe(:string)
          end

          rule(:loan_type) do
            valid_types = %w[borrowed lent]
            key.failure("must be one of: #{valid_types.join(", ")}") unless valid_types.include?(value)
          end

          rule(:interest_rate) do
            key.failure("must be between 0 and 100") if value < 0 || value >= 100
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler
        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          loan = transaction do
            params = step validate(params:)
            entity = step find_or_create_entity(params:)
            account = step find_account(params:)
            params = step transform_params(params:, entity:, account:)
            loan = step create_loan(params:)
            _ = step update_account_balance(loan:, account:)
            loan.reload
          end
          _ = step attach_file(loan:, params:)
          _ = step generate_embedding_async(loan:)
          loan.reload
        end

        private

        def find_or_create_entity(params:)
          entity = Entities::Entity.find_or_create_by!(
            space_id: params[:space_id],
            entity_type: "loan",
            full_name: params[:entity_name]
          )
          Success(entity)
        rescue ActiveRecord::RecordInvalid => e
          Failure(entity_name: "could not be created", error: e, expected: true)
        end

        def find_account(params:)
          account = Transactions::Account.kept.find_by(
            name: params[:account_name],
            space_id: params[:space_id]
          )
          return Failure(account_name: "not found") unless account

          Success(account)
        end

        def transform_params(params:, entity:, account:)
          params = params.dup
          params[:entity_id] = entity.id
          params[:account_id] = account.id
          params[:principal_amount_cents] = (params[:principal_amount] * 100).to_i
          params[:outstanding_balance_cents] = params[:principal_amount_cents]
          params[:currency] = "PHP"
          params[:maturity_date] = params[:date] + params[:loan_term_months].months
          params[:status] = "active"
          params.delete(:principal_amount)
          params.delete(:entity_name)
          params.delete(:account_name)
          params.delete(:file)
          params.delete(:file_id)

          Success(params)
        end

        def create_loan(params:)
          loan = Transactions::Loan.new(params)
          loan.save!
          Success(loan)
        rescue ActiveRecord::RecordInvalid => e
          Failure(errors: loan.errors.to_hash, error: e, expected: true)
        end

        def update_account_balance(loan:, account:)
          # Reload account to get latest balance
          account.reload

          # Calculate balance change based on loan type
          # borrowed = money coming in (increase balance)
          # lent = money going out (decrease balance)
          balance_change = case loan.loan_type
                          when "borrowed"
                            loan.principal_amount  # Add principal to account
                          when "lent"
                            -loan.principal_amount  # Subtract principal from account
                          else
                            Money.from_amount(0, loan.currency || "PHP")
                          end

          old_balance = account.balance.amount
          new_balance = old_balance + balance_change.amount

          # Update account balance
          account.assign_attributes(balance: Money.from_amount(new_balance, account.balance_currency))
          account.save!

          Success(account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(errors: account.errors.to_hash, error: e)
        end

        def attach_file(loan:, params:)
          return Success(loan) if params[:file].blank?

          Utils::ActiveStorage.attach_file(loan.files, params[:file], params[:space_id])
          Success(loan)
        end

        def generate_embedding_async(loan:)
          Ai::Embeddings::GenerateEmbeddingJob.perform_later(
            embeddable_id: loan.id,
            embeddable_type: loan.class.name,
            space_id: loan.space_id
          )
          Success(loan)
        end
      end
    end
  end
end



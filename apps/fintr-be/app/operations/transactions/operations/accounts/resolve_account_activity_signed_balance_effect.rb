# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      # Signed balance delta in +account.balance_currency+ for one account activity row.
      class ResolveAccountActivitySignedBalanceEffect < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:activity).filled(type?: ::Transactions::AccountActivity)
            required(:account).filled(type?: ::Transactions::Account)
          end
        end

        def call(params)
          params = step validate(params:)
          step resolve(params:)
        end

        private

        def validate(params:)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def resolve(params:)
          activity = params[:activity]
          account = params[:account]

          case activity.activity_kind
          when "income", "expense"
            resolve_transaction(activity:, account:)
          when "transfer"
            resolve_transfer(activity:, account:)
          when "loan_disbursement"
            resolve_loan_disbursement(activity:, account:)
          when "loan_payment"
            resolve_loan_payment(activity:, account:)
          else
            Failure(activity_kind: "unsupported")
          end
        end

        def resolve_transaction(activity:, account:)
          transactable = activity.activitable
          unless transactable.is_a?(::Transactions::Transaction)
            return Failure(activitable: "missing or invalid")
          end

          ::Transactions::Operations::Accounts::ResolveSignedBalanceEffect.new.call(
            transaction: transactable,
            account:,
            rate_date: rate_date_from(activity:),
          )
        end

        def resolve_transfer(activity:, account:)
          transfer = activity.activitable
          unless transfer.is_a?(::Transactions::Transfer)
            return Failure(activitable: "missing or invalid")
          end

          ::Transactions::Operations::Accounts::ResolveSignedTransferBalanceEffect.new.call(
            transfer:,
            account:,
            rate_date: rate_date_from(activity:),
          )
        end

        def resolve_loan_disbursement(activity:, account:)
          loan = activity.activitable
          unless loan.is_a?(::Transactions::Loan)
            return Failure(activitable: "missing or invalid")
          end

          principal = loan.principal_amount
          signed = case loan.loan_type
                   when "borrowed"
                     principal.amount
                   when "lent"
                     -principal.amount
                   else
                     0
                   end

          convert_signed_amount(
            signed_amount: signed,
            from_currency: loan.currency,
            account:,
            activity:,
          )
        end

        def resolve_loan_payment(activity:, account:)
          payment = activity.activitable
          unless payment.is_a?(::Transactions::LoanPayment)
            return Failure(activitable: "missing or invalid")
          end

          loan = payment.loan
          total = payment.total_payment
          signed = case loan.loan_type
                   when "borrowed"
                     -total.amount
                   when "lent"
                     total.amount
                   else
                     0
                   end

          convert_signed_amount(
            signed_amount: signed,
            from_currency: payment.currency,
            account:,
            activity:,
          )
        end

        def convert_signed_amount(signed_amount:, from_currency:, account:, activity:)
          from_currency = from_currency.to_s.presence || account.balance_currency.to_s
          account_currency = account.balance_currency.to_s

          if from_currency == account_currency
            Success(amount: BigDecimal(signed_amount.to_s).round(2))
          else
            ::ExchangeRates::Operations::ConvertSignedAmount.new.call(
              amount: signed_amount,
              from_currency:,
              to_currency: account_currency,
              space_id: account.space_id,
              date: rate_date_from(activity:),
            )
          end
        end

        def rate_date_from(activity:)
          d = activity.date
          d.respond_to?(:to_date) ? d.to_date : d
        end
      end
    end
  end
end

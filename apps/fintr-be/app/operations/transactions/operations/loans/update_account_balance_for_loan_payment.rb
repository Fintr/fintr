# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class UpdateAccountBalanceForLoanPayment < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:loan_payment).filled(type?: Transactions::LoanPayment)
            required(:loan).filled(type?: Transactions::Loan)
            required(:account).filled(type?: Transactions::Account)
            optional(:pending_conversion_data).maybe(:hash)
          end

          rule(:loan_payment) do
            key.failure("must be a persisted or changed record") unless value.persisted? || value.changed?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params         = step validate(params:)
          loan_payment   = params[:loan_payment]
          pending_conversion_data = params[:pending_conversion_data]
          old_account    = step find_old_account(params:)
          new_account    = step find_new_account(params:)

          if loan_payment.adjusts_account_balance_in_database
            _ = step reverse_old_account_balance(params:, old_account:)
          else
            _ = Success(nil)
          end

          if loan_payment.adjusts_account_balance
            balance_change = step calculate_balance_change(
              params:,
              pending_conversion_data:,
            )
            account        = step update_new_account_balance(
              params:,
              account: new_account,
              balance_change:,
            )
            account
          else
            new_account
          end
        end

        private

        def find_old_account(params:)
          loan_payment = params[:loan_payment]

          old_account_id = loan_payment.account_id_was
          return Success(nil) unless old_account_id

          old_account = Transactions::Account.find_by(id: old_account_id)
          return Success(nil) unless old_account

          old_account.reload
          Success(old_account)
        end

        def find_new_account(params:)
          account = params[:account]

          account.reload
          Success(account)
        end

        def reverse_old_account_balance(params:, old_account:)
          loan_payment = params[:loan_payment]
          loan = params[:loan]

          return Success(nil) unless old_account
          return Success(nil) unless balance_relevant_attributes_changed?(loan_payment:)

          old_total_payment_cents = loan_payment.total_payment_cents_was
          return Success(nil) unless old_total_payment_cents

          currency = loan.currency.presence || loan.space.currency.presence || "PHP"
          old_total_payment = Money.new(old_total_payment_cents, currency)

          balance_reversal = case loan.loan_type
          when "borrowed"
            old_total_payment
          when "lent"
            -old_total_payment
          else
            Money.from_amount(0, currency)
          end

          reversal_amount = step signed_payment_amount_in_account_currency(
            signed_amount: balance_reversal.amount,
            payment_currency: currency,
            account: old_account,
            loan_payment:,
            loan:,
            payment_date: loan_payment.date_was || loan_payment.date,
            pending_conversion_data: nil,
            use_persisted_conversion: true,
          )

          old_account.reload
          old_balance = old_account.balance.amount
          new_balance = old_balance + reversal_amount

          old_account.assign_attributes(balance: Money.from_amount(new_balance, old_account.balance_currency))
          save_result = ::Transactions::Operations::Accounts::SaveAccount.new.call(
            account: old_account,
            cause: "loan_payment_revert_balance",
            whodunnit: params[:loan].user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          Success(old_account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account_name: "failed to reverse", error: e)
        end

        def calculate_balance_change(params:, pending_conversion_data:)
          loan_payment = params[:loan_payment]
          loan = params[:loan]
          account = params[:account]

          signed_amount = case loan.loan_type
          when "borrowed"
            -loan_payment.total_payment.amount
          when "lent"
            loan_payment.total_payment.amount
          else
            0
          end

          return Success(0) if signed_amount.zero?

          signed_payment_amount_in_account_currency(
            signed_amount:,
            payment_currency: loan_payment.currency,
            account:,
            loan_payment:,
            loan:,
            payment_date: loan_payment.date,
            pending_conversion_data:,
            use_persisted_conversion: pending_conversion_data.blank?,
          )
        end

        def signed_payment_amount_in_account_currency(
          signed_amount:,
          payment_currency:,
          account:,
          loan_payment:,
          loan:,
          payment_date:,
          pending_conversion_data:,
          use_persisted_conversion:
        )
          to_currency = account.balance_currency.presence || "PHP"
          sign = signed_amount.negative? ? -1 : 1

          if pending_conversion_data.present? && pending_conversion_data[:needs_conversion]
            converted = BigDecimal(pending_conversion_data[:converted_amount].to_s).round(2)
            return Success(sign * converted.abs)
          end

          if use_persisted_conversion &&
              loan_payment.respond_to?(:has_currency_conversion?) &&
              loan_payment.has_currency_conversion? &&
              loan_payment.currency_conversion.converted_currency == to_currency
            converted = loan_payment.currency_conversion.converted_money.amount.to_d
            return Success(sign * converted.abs)
          end

          from_currency = payment_currency.presence || loan.currency.presence || loan.space.currency.presence || "PHP"

          if from_currency == to_currency
            return Success(signed_amount)
          end

          rate_date = payment_date.respond_to?(:to_date) ? payment_date.to_date : payment_date
          conversion = ::ExchangeRates::Operations::ConvertSignedAmount.new.call(
            amount: signed_amount,
            from_currency:,
            to_currency:,
            space_id: loan.space_id,
            date: rate_date
          )
          return conversion if conversion.failure?

          Success(conversion.value![:amount])
        end

        def balance_relevant_attributes_changed?(loan_payment:)
          loan_payment.account_id_changed? ||
            loan_payment.total_payment_cents_changed? ||
            loan_payment.adjusts_account_balance_changed?
        end

        def update_new_account_balance(params:, account:, balance_change:)
          account.reload

          old_balance = account.balance.amount
          new_balance = old_balance + balance_change

          account.assign_attributes(balance: Money.from_amount(new_balance, account.balance_currency))
          save_result = ::Transactions::Operations::Accounts::SaveAccount.new.call(
            account:,
            cause: "loan_payment_apply_balance",
            whodunnit: params[:loan].user_id,
            operation: self.class.name
          )
          return save_result if save_result.failure?

          Success(account)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(account_name: "failed to update", error: e)
        end
      end
    end
  end
end

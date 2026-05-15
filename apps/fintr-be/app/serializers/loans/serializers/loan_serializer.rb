# frozen_string_literal: true

module Loans
  module Serializers
    class LoanSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :loan_type,
             :loan_term_months,
             :maturity_date,
             :status,
             :paid_off_date,
             :interest_rate,
             :adjusts_account_balance

      field :entity_name do |record|
        record.entity.full_name
      end

      field :account_name do |record|
        record.account.name
      end

      field :principal_amount do |record|
        record.principal_amount.amount
      end

      field :principal_amount_currency do |record|
        record.currency
      end

      field :outstanding_balance do |record|
        record.outstanding_balance.amount
      end

      field :outstanding_balance_currency do |record|
        record.currency
      end

      field :value do |record|
        record.value.amount
      end

      field :income do |record|
        record.income.amount
      end

      field :expense do |record|
        record.expense.amount
      end

      field :total_value do |record|
        record.total_value.amount
      end

      field :files do |record|
        record.files.map do |file|
          {
            id: file.id,
            filename: file.filename.to_s,
            content_type: file.content_type,
            url: file.url,
            created_at: file.created_at
          }
        end
      end

      field :loan_payments do |record|
        record.loan_payments.order(:date).map do |payment|
          {
            id: payment.id,
            date: payment.date,
            principal_payment: payment.principal_payment.amount,
            interest_payment: payment.interest_payment.amount,
            total_payment: payment.total_payment.amount,
            currency: payment.currency,
            adjusts_account_balance: payment.adjusts_account_balance
          }
        end
      end

      field :amortization_schedule do |record|
        record.generate_amortization_schedule.map do |entry|
          {
            payment_date: entry[:payment_date].iso8601,
            beginning_balance: entry[:beginning_balance],
            payment_amount: entry[:payment_amount],
            principal_payment: entry[:principal_payment],
            interest_payment: entry[:interest_payment],
            ending_balance: entry[:ending_balance],
            is_actual: entry[:is_actual] || false
          }
        end
      end
    end
  end
end

# frozen_string_literal: true

module Loans
  module Serializers
    class LoanSummarySerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :description,
             :loan_type,
             :loan_term_months,
             :maturity_date,
             :status,
             :interest_rate

      field :entity_name do |record|
        record.entity.full_name
      end

      field :account_name do |record|
        record.account.name
      end

      field :principal_amount do |record|
        record.principal_amount.amount
      end

      field :outstanding_balance do |record|
        record.outstanding_balance.amount
      end

      field :currency do |record|
        record.currency
      end
    end
  end
end

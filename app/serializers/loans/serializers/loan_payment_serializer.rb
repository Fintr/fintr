# frozen_string_literal: true

module Loans
  module Serializers
    class LoanPaymentSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :notes,
             :currency

      field :loan_id do |record|
        record.loan_id
      end

      field :account_id do |record|
        record.account_id
      end

      field :account_name do |record|
        record.account.name
      end

      field :principal_payment do |record|
        record.principal_payment.amount
      end

      field :interest_payment do |record|
        record.interest_payment.amount
      end

      field :total_payment do |record|
        record.total_payment.amount
      end
    end
  end
end



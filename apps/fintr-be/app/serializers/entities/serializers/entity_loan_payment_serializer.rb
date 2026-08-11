# frozen_string_literal: true

module Entities
  module Serializers
    class EntityLoanPaymentSerializer < Blueprinter::Base
      identifier :id

      fields :date,
             :notes,
             :currency

      field :loan_id do |record|
        record.loan_id
      end

      field :loan_description do |record|
        record.loan.description
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

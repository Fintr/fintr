# frozen_string_literal: true

module Entities
  module Serializers
    class EntityDetailSerializer < Blueprinter::Base
      field :entity do |record, _options|
        EntitySerializer.render_as_hash(record[:entity])
      end

      field :transactions do |record, _options|
        ::Transactions::Serializers::TransactionSerializer.render_as_hash(record[:transactions])
      end

      field :loans do |record, _options|
        ::Loans::Serializers::LoanSummarySerializer.render_as_hash(record[:loans])
      end

      field :loan_payments do |record, _options|
        EntityLoanPaymentSerializer.render_as_hash(record[:loan_payments])
      end

      field :identifiers do |record, _options|
        MerchantAliasSerializer.render_as_hash(record[:identifiers])
      end
    end
  end
end

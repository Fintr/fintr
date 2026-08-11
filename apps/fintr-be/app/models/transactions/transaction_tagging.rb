# frozen_string_literal: true

module Transactions
  class TransactionTagging < ApplicationRecord
    self.table_name = "transaction_taggings"
    self.primary_key = %i[transaction_id tag_id]

    belongs_to :tagged_transaction,
               class_name: "Transactions::Transaction",
               foreign_key: :transaction_id,
               inverse_of: :transaction_taggings
    belongs_to :tag, class_name: "Transactions::Tag"
  end
end

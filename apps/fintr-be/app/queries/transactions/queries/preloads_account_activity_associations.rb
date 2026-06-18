# frozen_string_literal: true

module Transactions
  module Queries
    module PreloadsAccountActivityAssociations
      module_function

      def apply(relation)
        return relation unless relation.respond_to?(:includes)

        relation.includes(
          :account,
          :space,
          activitable: [
            :space,
            :currency_conversion,
            :category,
            :subcategory,
            { files_attachments: :blob },
            :loan,
            :entity,
            :account,
            :transaction_record,
            { loan: :entity }
          ]
        )
      end
    end
  end
end

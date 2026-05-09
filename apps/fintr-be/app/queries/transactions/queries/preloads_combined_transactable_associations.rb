# frozen_string_literal: true

module Transactions
  module Queries
    # Preloads associations used when iterating +Combined+ rows for the transactions index,
    # CSV export, and +TotalsByType+ (+AmountInSpaceForTransactable+, serializers).
    #
    # Mitigates duplicate SELECT patterns seen in Sentry Performance traces (e.g. repeated
    # +spaces+ and polymorphic +currency_conversions+ loads per row).
    module PreloadsCombinedTransactableAssociations
      module_function

      def apply(relation)
        return relation unless relation.respond_to?(:includes)

        relation.includes(
          :space,
          transactable: [
            :currency_conversion,
            :space,
            { files_attachments: :blob },
          ]
        )
      end
    end
  end
end

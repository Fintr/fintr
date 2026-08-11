# frozen_string_literal: true

module Transactions
  module Operations
    module Concerns
      module SyncsTransactionTags
        private

        def sync_transaction_tags(transaction:, params:, apply_default: false)
          tag_ids = if params.key?(:tag_ids)
                      params[:tag_ids] || []
                    elsif apply_default
                      default_tag = Transactions::Tag.find_by(
                        space_id: params[:space_id],
                        is_default: true,
                      )
                      default_tag ? [default_tag.id] : []
                    else
                      return Success(transaction)
                    end

          tags = step Transactions::Operations::ResolveTagAssignment.new.call(
            space_id: params[:space_id],
            tag_ids:,
          )
          desired_tag_ids = tags.map(&:id)
          transaction.tag_ids = desired_tag_ids
          transaction.association(:tags).reset
          Success(transaction)
        end
      end
    end
  end
end

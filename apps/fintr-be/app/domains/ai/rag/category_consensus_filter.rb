# frozen_string_literal: true

module Ai
  module Rag
    # Drops weak semantic false positives by keeping only categories that dominate
    # the highest-similarity anchor matches (e.g. dining -> Dine Out, not Pet).
    class CategoryConsensusFilter
      ANCHOR_COUNT = 10
      MIN_CATEGORY_VOTES = 3

      class << self
        def filter_results(results)
          anchors = Array(results).first(ANCHOR_COUNT)
          return [] if anchors.empty?

          allowed_categories = allowed_categories_from(anchors)

          Array(results).select do |result|
            category = category_name(result)
            category.present? && allowed_categories.include?(category)
          end
        end

        private

        def allowed_categories_from(anchors)
          votes = anchors.each_with_object(Hash.new(0)) do |result, counts|
            name = category_name(result)
            counts[name] += 1 if name.present?
          end

          return [] if votes.empty?

          qualified = votes.select { |_, count| count >= MIN_CATEGORY_VOTES }.keys
          return qualified if qualified.any?

          [votes.max_by { |_, count| count }.first]
        end

        def category_name(result)
          metadata = result[:metadata] || {}
          metadata["category"].presence || metadata[:category].presence
        end
      end
    end
  end
end

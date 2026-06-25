# frozen_string_literal: true

module Transactions
  module Queries
    module CategoryFilterTokens
      module_function

      def normalize(params)
        tokens = Array(params[:category_filters]).map(&:to_s).reject(&:blank?)
        return tokens if tokens.any?

        if params[:category_id].present?
          token = params[:category_id].to_s
          token = "#{token}:#{params[:subcategory_id]}" if params[:subcategory_id].present?
          return [token]
        end

        []
      end

      def legacy_blank?(params)
        return false if normalize(params).any?
        return false if params[:category_id].present?

        category_name = params[:category_name]
        return true if category_name.nil?

        normalized_name = category_name.to_s.strip
        normalized_name.empty? || normalized_name == "all"
      end
    end
  end
end

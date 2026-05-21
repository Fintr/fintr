# frozen_string_literal: true

module Transactions
  module Operations
    class ResolveCategoryAssignment < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
          optional(:category_name).maybe(:string)
          optional(:transaction_type).maybe(:string)
        end

        rule(:category_id, :category_name) do
          if values[:category_id].blank? && values[:category_name].blank?
            key(:category_id).failure("category_id or category_name is required")
          end
        end

        rule(:category_id, :subcategory_id, :category_name) do
          next if values[:category_id].present?
          next if values[:subcategory_id].blank?

          name = values[:category_name].to_s
          next if name.include?(":")

          key(:category_id).failure("is required when subcategory_id is provided")
        end
      end

      def call(params)
        params = step validate(params:)
        normalized = step normalize_category_ids(params:)
        step resolve_assignment(normalized:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def normalize_category_ids(params:)
        category_id = params[:category_id].presence
        subcategory_id = params[:subcategory_id].presence
        category_name = params[:category_name].to_s.strip

        if category_id.present?
          return Success(
            space_id: params[:space_id],
            category_id:,
            subcategory_id:
          )
        end

        return Failure(category_id: "category_id or category_name is required") if category_name.blank?

        if category_name.include?(":")
          parent_id, sub_id = category_name.split(":", 2)

          return Success(
            space_id: params[:space_id],
            category_id: parent_id.presence,
            subcategory_id: sub_id.presence || subcategory_id
          )
        end

        record = Transactions::Category.find_by(
          id: category_name,
          space_id: params[:space_id]
        )

        if record.present?
          if record.subcategory?
            return Success(
              space_id: params[:space_id],
              category_id: record.parent_id,
              subcategory_id: record.id
            )
          end

          return Success(
            space_id: params[:space_id],
            category_id: record.id,
            subcategory_id:
          )
        end

        transaction_type = params[:transaction_type]
        return Failure(category_name: "not found") if transaction_type.blank?

        parent = Transactions::Category.find_by(
          name: category_name,
          space_id: params[:space_id],
          category_type: transaction_type,
          parent_id: nil
        )
        return Failure(category_name: "not found") if parent.blank?

        Success(
          space_id: params[:space_id],
          category_id: parent.id,
          subcategory_id:
        )
      end

      def resolve_assignment(normalized:)
        parent = Transactions::Category.find_by(
          id: normalized[:category_id],
          space_id: normalized[:space_id]
        )
        return Failure(category_id: "not found") if parent.blank?
        return Failure(category_id: "must be a parent category") unless parent.root?

        subcategory_id = normalized[:subcategory_id].presence
        if subcategory_id.blank?
          return Success(
            {
              category_id: parent.id,
              subcategory_id: nil
            }
          )
        end

        sub = Transactions::Category.find_by(
          id: subcategory_id,
          space_id: normalized[:space_id]
        )
        return Failure(subcategory_id: "not found") if sub.blank?
        return Failure(subcategory_id: "must be a subcategory") unless sub.subcategory?

        if sub.parent_id != parent.id
          return Failure(subcategory_id: "must belong to the selected parent category")
        end

        Success(
          {
            category_id: parent.id,
            subcategory_id: sub.id
          }
        )
      end
    end
  end
end

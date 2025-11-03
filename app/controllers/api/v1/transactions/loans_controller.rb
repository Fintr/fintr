# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class LoansController < ApiController
        def index
          loans = current_space.loans.order(date: :desc, created_at: :desc)

          per_page = params[:per_page]&.to_i || 10
          per_page = [per_page, 100].min

          paginated_loans = loans.page(params[:page]).per(per_page)

          render_paginated(
            paginated_loans,
            serializer: ::Loans::Serializers::LoanSerializer,
            key: :loans
          )
        end

        def show
          loan = current_space.loans.find(params[:id])
          serializer = ::Loans::Serializers::LoanSerializer.render_as_hash(loan)
          render_success(data: serializer)
        end

        def create
          params = with_current_params(create_params)
          operation = ::Transactions::Operations::Loans::CreateLoan.new.call(params)

          return render_internal_server_error(details: operation.failure) unless operation.success?

          serializer = ::Loans::Serializers::LoanSerializer.render_as_hash(operation.value!)
          render_created(data: serializer)
        end

        def update
          params = with_current_params(update_params)
          operation = ::Loans::Operations::UpdateLoan.new.call(params)

          return render_internal_server_error(details: operation.failure) unless operation.success?

          serializer = ::Loans::Serializers::LoanSerializer.render_as_hash(operation.value!)
          render_success(data: serializer)
        end

        def destroy
          destroy_params = { loan_id: params[:id] }
          params = with_current_params(destroy_params)
          operation = ::Transactions::Operations::Loans::DeleteLoan.new.call(params)

          return render_internal_server_error(details: operation.failure) unless operation.success?

          render_success(message: "Loan deleted successfully")
        end

        private

        def create_params
          params.permit(
            :principal_amount,
            :interest_rate,
            :date,
            :loan_type,
            :entity_name,
            :account_name,
            :loan_term_months,
            :description,
            :file,
            :file_id
          )
        end

        def update_params
          params.permit(
            :id,
            :principal_amount,
            :interest_rate,
            :date,
            :loan_type,
            :entity_name,
            :loan_term_months,
            :description,
            :file
          )
        end
      end
    end
  end
end

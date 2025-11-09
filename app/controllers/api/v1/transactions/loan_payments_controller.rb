# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class LoanPaymentsController < ApiController
        def index
          loan = current_space.loans.find(params[:loan_id])
          loan_payments = loan.loan_payments.order(date: :desc)
          serializer = ::Loans::Serializers::LoanPaymentSerializer.render_as_hash(loan_payments)
          render_success(data: serializer)
        end

        def show
          loan = current_space.loans.find(params[:loan_id])
          loan_payment = loan.loan_payments.find(params[:id])
          serializer = ::Loans::Serializers::LoanPaymentSerializer.render_as_hash(loan_payment)
          render_success(data: serializer)
        end

        def create
          create_params_with_loan = create_params.merge(loan_id: params[:loan_id])
          params = with_current_params(create_params_with_loan)
          operation = ::Transactions::Operations::Loans::CreateLoanPayment.new.call(params)

          return render_internal_server_error(details: operation.failure) unless operation.success?

          serializer = ::Loans::Serializers::LoanPaymentSerializer.render_as_hash(operation.value!)
          render_created(data: serializer)
        end

        def update
          update_params_with_id = update_params.merge(loan_payment_id: params[:id])
          params = with_current_params(update_params_with_id)
          operation = ::Transactions::Operations::Loans::UpdateLoanPayment.new.call(params)

          return render_internal_server_error(details: operation.failure) unless operation.success?

          serializer = ::Loans::Serializers::LoanPaymentSerializer.render_as_hash(operation.value!)
          render_success(data: serializer)
        end

        def destroy
          destroy_params = { loan_payment_id: params[:id] }
          params = with_current_params(destroy_params)
          operation = ::Transactions::Operations::Loans::DeleteLoanPayment.new.call(params)

          return render_internal_server_error(details: operation.failure) unless operation.success?

          render_success(message: "Loan payment deleted successfully")
        end

        private

        def create_params
          params.permit(
            :account_name,
            :date,
            :total_payment,
            :principal_payment,
            :notes
          )
        end

        def update_params
          params.permit(
            :account_name,
            :date,
            :total_payment,
            :principal_payment,
            :notes
          )
        end
      end
    end
  end
end
